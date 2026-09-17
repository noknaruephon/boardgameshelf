import { supabase } from './supabase.js';
import { GOOGLE_CLIENT_ID } from './config.js';

// Supabase Auth helpers shared by landing.html, settings.html and the shelf.
// Google OAuth and magic-link email both land on /welcome, which sends a
// user with a shelf straight to it, resumes an unfinished sync, and shows
// the connect screen to a brand-new user. It is also the page where a
// first-time user is made to claim their BGG username.

const AFTER_SIGN_IN_URL = () => `${location.origin}/welcome`;

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
    options: { redirectTo: AFTER_SIGN_IN_URL() },
  });
  if (error) throw error;
}

/**
 * Sign in with an ID token from Google's own sign-in button (Google Identity
 * Services) rendered on this site. Google's consent screen then names this
 * site's domain instead of the Supabase callback. `nonce` is the raw value
 * whose SHA-256 hash was given to Google; Supabase checks it against the
 * token.
 */
export async function signInWithGoogleCredential(credential, nonce) {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: credential,
    nonce,
  });
  if (error) throw error;
}

/**
 * Facebook Login, through Supabase's OAuth redirect. There is no on-site
 * button flow for Facebook the way Google Identity Services gives one, so
 * this takes the visitor to Facebook and back to /welcome. Facebook accounts
 * without an email address are rejected by Supabase, which surfaces here as
 * an error on the landing page.
 */
export async function signInWithFacebook() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: { redirectTo: AFTER_SIGN_IN_URL(), scopes: 'email' },
  });
  if (error) throw error;
}

export { GOOGLE_CLIENT_ID };

/** A random nonce and its SHA-256 hex digest, for the Google ID-token flow. */
export async function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: AFTER_SIGN_IN_URL(), shouldCreateUser: true },
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

const PROFILE_COLUMNS = 'id, slug, bgg_username, display_name, display_name_updated_at, is_public, show_expansions, theme, last_synced_at, created_at';

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
 * Renames the shelf's display name through update_display_name(), the only
 * write path for that column (a trigger refuses a direct update). The RPC
 * normalises and validates; its error message is what the sheet shows.
 * @returns {Promise<object>} the updated profile row
 */
export async function updateDisplayName(name) {
  const { data, error } = await supabase.rpc('update_display_name', { p_name: String(name ?? '') });
  if (error) throw error;
  return data;
}

/**
 * Save the shelf's theme (docs/claude-code-spec-themes.md) through
 * update_theme(), which validates the id against the registry server-side.
 * null clears it. Resolves to the updated profile row.
 */
export async function updateTheme(theme) {
  const { data, error } = await supabase.rpc('update_theme', { p_theme: theme ?? null });
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
