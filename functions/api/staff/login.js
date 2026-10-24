import { json } from '../../_lib/data.js';
import { createSession, sessionCookie, verifyStaffPassword } from '../../_lib/staff-auth.js';

const WINDOW_SECONDS = 600;
const MAX_ATTEMPTS = 5;

export async function onRequestPost({ request, env }) {
  if (!env.ENTRIES) return json({ error: 'Staff login is not configured.' }, 503);
  if (!env.STAFF_SESSION_SECRET || env.STAFF_SESSION_SECRET.length < 32) {
    return json({ error: 'Staff authentication is not configured.' }, 503);
  }
  if (typeof env.STAFF_PASSWORD !== 'string' || !env.STAFF_PASSWORD) {
    return json({ error: 'Staff password is not configured.' }, 503);
  }
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'Request origin rejected.' }, 403);
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKey = `staff-login:${clientIp}`;
  try {
    const count = Number(await env.ENTRIES.get(rateKey) || 0);
    if (count >= MAX_ATTEMPTS) return json({ error: 'Too many login attempts. Try again in 10 minutes.' }, 429);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 1024) return json({ error: 'Invalid login request.' }, 400);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400);
    }
    if (!await verifyStaffPassword(body?.password, env)) {
      await env.ENTRIES.put(rateKey, String(count + 1), { expirationTtl: WINDOW_SECONDS });
      return json({ error: 'Incorrect password.' }, 401);
    }
    await env.ENTRIES.delete(rateKey);
    const token = await createSession(env);
    if (!token) return json({ error: 'Staff authentication is not configured.' }, 503);
    return new Response(JSON.stringify({ authenticated: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(request, token)
      }
    });
  } catch {
    return json({ error: 'Could not verify staff login.' }, 503);
  }
}