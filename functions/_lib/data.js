export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}

export function requireSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Cross-origin request rejected.' }, 403);
  return null;
}

export async function readEntries(env) {
  if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
  const saved = await env.ENTRIES.get('board');
  if (!saved) return [];
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((entry) => entry && typeof entry.id === 'string' && (typeof entry.name === 'string' || typeof entry.text === 'string'))
    .map((entry) => {
      const legacyLinks = typeof entry.text === 'string' ? entry.text.split(/[\r\n\s]+/).filter((value) => /^https?:\/\//i.test(value)) : [];
      return {
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name : entry.text,
        links: Array.isArray(entry.links) ? entry.links.filter((value) => typeof value === 'string') : legacyLinks,
        category: ['websites', 'eagler', 'movies'].includes(entry.category) ? entry.category : 'websites',
        pinned: entry.pinned === true,
        createdAt: entry.createdAt || null
      };
    });
}

export async function writeEntries(env, entries) {
  await env.ENTRIES.put('board', JSON.stringify(entries));
}
