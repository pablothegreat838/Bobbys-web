import { isSameOrigin, sessionCookie } from '../_lib/auth.js';
import { json } from '../_lib/data.js';

export async function onRequestPost({ request }) {
  if (!isSameOrigin(request)) return json({ error: 'Cross-origin request rejected.' }, 403);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': sessionCookie('', 0)
    }
  });
}