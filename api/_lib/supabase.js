import { createClient } from '@supabase/supabase-js';
import { HttpError, bearerToken } from './http.js';

// The service-role client. Bypasses RLS, so it only ever lives in these
// functions and in scripts/ — never in anything the browser loads.
let admin = null;
export function adminClient() {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new HttpError(500, 'Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}

/**
 * Verifies the caller's JWT with Supabase Auth and loads their profile.
 * The bearer token is the user's access token from supabase-js on the client;
 * nothing about the user is trusted from the request body.
 *
 * @returns {Promise<{ user: object, profile: object }>}
 */
export async function requireProfile(req) {
  const { user, profile } = await requireProfileOrUser(req);
  // A row can exist before the username is claimed; that is not a profile to sync.
  if (!profile?.bgg_username) throw new HttpError(404, 'Set your BGG username in Settings before syncing.');
  return { user, profile };
}

/**
 * Same check, but a user who has not claimed a profile yet is allowed
 * through — the onboarding lookup runs before the profile row exists.
 * @returns {Promise<{ user: object, profile: object|null }>}
 */
export async function requireProfileOrUser(req) {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'Sign in to sync.');

  const db = adminClient();
  const { data: { user } = {}, error } = await db.auth.getUser(token);
  if (error || !user) throw new HttpError(401, 'Your session has expired. Sign in again.');

  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('id, slug, bgg_username, display_name, is_public, last_synced_at')
    .eq('id', user.id)
    .maybeSingle();
  if (pErr) throw pErr;

  return { user, profile: profile || null };
}
