import { json } from '../_lib/data.js';

const LINKS_KEY = 'links';
const MAX_TITLE_LENGTH = 200;
const MAX_URL_LENGTH = 2048;

function authorized(request, env) {
  if (!env.API_SECRET) return json({ error: 'The API_SECRET environment variable is not configured.' }, 503);
  if (request.headers.get('Authorization') !== `Bearer ${env.API_SECRET}`) {
    return json({ error: 'Unauthorized.' }, 401);
  }
  return null;
}

async function readLinks(env) {
  if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
  const saved = await env.ENTRIES.get(LINKS_KEY);
  if (!saved) return [];
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((link) => link && typeof link.id === 'string' && typeof link.url === 'string' && typeof link.title === 'string');
}

async function writeLinks(env, links) {
  await env.ENTRIES.put(LINKS_KEY, JSON.stringify(links));
}

export async function onRequestGet({ env }) {
  try {
    return json(await readLinks(env));
  } catch {
    return json({ error: 'Could not load links.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = authorized(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (!body || typeof body.url !== 'string' || typeof body.title !== 'string') {
    return json({ error: 'Provide a URL and title.' }, 400);
  }

  const url = body.url.trim();
  const title = body.title.trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return json({ error: 'Provide a valid HTTP or HTTPS URL.' }, 400);
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || url.length > MAX_URL_LENGTH) {
    return json({ error: 'Provide a valid HTTP or HTTPS URL no longer than 2,048 characters.' }, 400);
  }
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return json({ error: 'Title must contain 1 to 200 characters.' }, 400);
  }

  try {
    const links = await readLinks(env);
    const link = { id: crypto.randomUUID(), url: parsedUrl.toString(), title, createdAt: new Date().toISOString() };
    await writeLinks(env, [...links, link]);
    return json(link, 201);
  } catch {
    return json({ error: 'Could not add link.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = authorized(request, env);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (!body || typeof body.id !== 'string' || !body.id.trim()) {
    return json({ error: 'Provide a link id.' }, 400);
  }

  try {
    const links = await readLinks(env);
    const remaining = links.filter((link) => link.id !== body.id);
    if (remaining.length === links.length) return json({ error: 'Link not found.' }, 404);
    await writeLinks(env, remaining);
    return json({ ok: true });
  } catch {
    return json({ error: 'Could not delete link.' }, 503);
  }
}