// POST /api/account/delete — removes the caller's account for good.
//
// Deletes the profile row (user_games cascades; sessions and votes keep
// their rows with owner_id set to null so a running game night is not
// pulled out from under the table), then the auth user itself. The auth
// deletion needs the service role, which is why this is a function and not
// a client call. Nothing here is recoverable; the page confirms first.

import { handler, json } from '../_lib/http.js';
import { adminClient, requireProfileOrUser } from '../_lib/supabase.js';

export default handler(async (req, res) => {
  const { user } = await requireProfileOrUser(req);
  const db = adminClient();

  const { error: pErr } = await db.from('profiles').delete().eq('id', user.id);
  if (pErr) throw pErr;

  const { error: aErr } = await db.auth.admin.deleteUser(user.id);
  if (aErr) throw aErr;

  json(res, 200, { status: 'ok' });
});
