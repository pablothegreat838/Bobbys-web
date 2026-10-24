import { json } from '../../_lib/data.js';
import { hasStaffSession } from '../../_lib/staff-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.STAFF_SESSION_SECRET || env.STAFF_SESSION_SECRET.length < 32) {
    return json({ authenticated: false, error: 'Staff authentication is not configured.' }, 503);
  }
  return json({ authenticated: await hasStaffSession(request, env) });
}

export async function onRequestPost({ request }) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'Request origin rejected.' }, 403);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return new Response(JSON.stringify({ authenticated: false }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': `bobbys_staff_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`
    }
  });
}