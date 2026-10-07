import { createSession, isSameOrigin, passwordMatches, sessionCookie } from '../_lib/auth.js';
import { json } from '../_lib/data.js';

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: 'Cross-origin request rejected.' }, 403);
  const missing = [
    !env.ENTRIES && 'ENTRIES KV namespace binding',
    !env.STAFF_PASSWORD && 'STAFF_PASSWORD secret',
    !env.SESSION_SECRET && 'SESSION_SECRET secret'
  ].filter(Boolean);
  if (missing.length) return json({ error: `Missing Pages configuration: ${missing.join(', ')}.` }, 503);
  try {
    const body = await request.json();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const attemptKey = `login-attempts:${ip}`;
    const attempts = Number(await env.ENTRIES.get(attemptKey) || 0);
    if (attempts >= 5) return json({ error: 'Too many attempts. Try again in 10 minutes.' }, 429);
    if (typeof body.password !== 'string' || !await passwordMatches(body.password, env.STAFF_PASSWORD)) {
      await env.ENTRIES.put(attemptKey, String(attempts + 1), { expirationTtl: 600 });
      return json({ error: 'Incorrect password.' }, 401);
    }
    await env.ENTRIES.delete(attemptKey);
    const token = await createSession(env);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(token)
      }
    });
  } catch {
    return json({ error: 'Could not sign in. Check the Pages configuration.' }, 500);
  }
}