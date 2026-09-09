// Supabase project configuration.
//
// The anon key is a public identifier, not a secret — access is controlled by
// row-level security and the database functions, not by hiding this value.
// SUPABASE_SERVICE_ROLE_KEY is a real secret and must never appear in this repo.
export const SUPABASE_URL = 'https://vgqomqxvbvvmqpeudvqd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncW9tcXh2YnZ2bXFwZXVkdnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NDM1NTcsImV4cCI6MjEwMzIxOTU1N30.GfI2zjD7a2Sc721gCBvFYBWeZMb2Vvyzmp5hIvUJI8Y';

// The shelf that game nights created before profiles existed belong to
// (their sessions.owner_id is null). Also where the migration script lands
// games.json. Lowercase: it is compared against profiles.slug.
export const DEFAULT_SHELF_SLUG = 'noknaruephon';

// Google OAuth client ID (Google Cloud Console → Credentials → the Web
// application client). Public by design: it identifies the app, it does not
// authenticate it. When set, the landing page signs people in with Google's
// own button on this site, so Google's screen shows this domain rather than
// the Supabase project address. Leave empty to fall back to the redirect flow
// through Supabase.
export const GOOGLE_CLIENT_ID = '';
