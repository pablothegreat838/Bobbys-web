import { isAuthenticated, isSameOrigin } from './auth.js';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function requireStaff(request, env) {
  if (!isSameOrigin(request)) return json({ error: 'Cross-origin request rejected.' }, 403);
  if (!await isAuthenticated(request, env)) return json({ error: 'Staff sign-in required.' }, 401);
  return null;
}

export async function readEntries(env) {
  if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
  const saved = await env.ENTRIES.get('board');
  if (!saved) return [];
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.text === 'string' && ['blocked', 'unblocked'].includes(entry.status));
}

export async function writeEntries(env, entries) {
  await env.ENTRIES.put('board', JSON.stringify(entries));
}

export async function releaseExpired(env, entries) {
  let changed = false;
  const now = Date.now();
  const updated = entries.map((entry) => {
    if (entry.status === 'blocked' && entry.releaseAt && Date.parse(entry.releaseAt) <= now) {
      changed = true;
      return { ...entry, status: 'unblocked', releaseAt: null };
    }
    return entry;
  });
  if (changed) await writeEntries(env, updated);
  return updated;
}