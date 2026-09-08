import { supabase } from './supabase.js';

// Supabase Auth helpers shared by landing.html, settings.html and the shelf.
// Google OAuth and magic-link email both land on /settings, which is where a
// first-time user is made to claim their BGG username.

const SETTINGS_URL = () => `${location.origin}/settings`;

/** @returns {Promise<object|null>} the current auth user, or null when signed out */
export async function getUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/** The access token the /api functions verify. */
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export function onAuthChange(fn) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => fn(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: SETTINGS_URL() },
  });
  if (error) throw error;
}

export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: SETTINGS_URL(), shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * BGG username → profile slug. Mirrors slugify_bgg_username() in the
 * migration: lowercase, trimmed, whitespace runs → one hyphen.
 */
export function slugify(username) {
  return String(username || '').trim().toLowerCase().replace(/\s+/g, '-');
}

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const isValidSlug = (slug) => SLUG_RE.test(slug);

const PROFILE_COLUMNS = 'id, slug, bgg_username, display_name, is_public, last_synced_at, created_at';

/** The signed-in user's own profile row, or null before they have claimed one. */
export async function fetchMyProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * First-login step: claim a BGG username as this user's slug.
 * @returns {Promise<{ profile?: object, error?: 'taken' | 'invalid' }>}
 */
export async function claimProfile({ bggUsername, displayName }) {
  const user = await getUser();
  if (!user) throw new Error('Not signed in');
  const bgg = String(bggUsername || '').trim();
  const slug = slugify(bgg);
  if (!isValidSlug(slug)) return { error: 'invalid' };

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      slug,
      bgg_username: bgg,
      display_name: (displayName || '').trim() || bgg,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    // 23505 = unique_violation. First claim wins; this one lost.
    if (error.code === '23505') return { error: 'taken' };
    throw error;
  }
  return { profile: data };
}

/**
 * Changes the BGG username, and with it the slug (the shelf's address).
 * Clears last_synced_at so the next sync is understood to be from scratch:
 * the old username's games are removed by that sync's reconcile step.
 * @returns {Promise<{ profile?: object, error?: 'taken' | 'invalid' }>}
 */
export async function changeBggUsername(bggUsername) {
  const bgg = String(bggUsername || '').trim();
  const slug = slugify(bgg);
  if (!isValidSlug(slug)) return { error: 'invalid' };
  try {
    const profile = await updateMyProfile({ bgg_username: bgg, slug, last_synced_at: null });
    return { profile };
  } catch (error) {
    if (error?.code === '23505') return { error: 'taken' };
    throw error;
  }
}

export async function updateMyProfile(patch) {
  const user = await getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Live check of a BGG username through /api/bgg/lookup.
 * @returns {Promise<{ found: boolean, username?: string, count?: number|null }>}
 *   throws with `retryAfter` (seconds) when the endpoint asks to slow down
 */
export async function lookupBggUser(name, { signal } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(`/api/bgg/lookup?name=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (res.status === 429) {
    const err = new Error(data.message || 'Slow down a moment.');
    err.retryAfter = Number(data.retryAfter) || 1;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(data.message || "Couldn't reach BGG. Try again in a moment.");
    err.status = res.status;
    throw err;
  }
  return data;
}

/** A name to greet the user with before they have a profile. */
export function userDisplayName(user) {
  const m = user?.user_metadata || {};
  return m.full_name || m.name || m.user_name || (user?.email ? user.email.split('@')[0] : '');
}
