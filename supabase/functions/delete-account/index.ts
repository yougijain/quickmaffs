// Deletes the calling user's account and all their data. Required by Apple
// App Store Guideline 5.1.1(v) (in-app account deletion).
//
// The anon client cannot delete an auth user, so this runs with the service
// role key (auto-injected into the Edge runtime). It authenticates the caller
// from their JWT, wipes their rows, then deletes the auth user itself. All the
// data tables also cascade on auth.users delete, so the explicit deletes are
// belt-and-suspenders.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Missing authorization.' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Identify the caller strictly from their token — never from the body.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: 'Invalid session.' }, 401);
    const userId = userData.user.id;

    // Remove their data first, then the account.
    await admin.from('attempts').delete().eq('user_id', userId);
    await admin.from('sessions').delete().eq('user_id', userId);
    await admin.from('user_settings').delete().eq('user_id', userId);

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
