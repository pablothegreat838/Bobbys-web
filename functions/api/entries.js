import { json, readEntries, requireSameOrigin, writeEntries } from '../_lib/data.js';

const MAX_ENTRIES = 5000;
const MAX_NAME_LENGTH = 200;
const MAX_LINKS_PER_ENTRY = 500;
const MAX_URL_LENGTH = 2048;
const CATEGORIES = ['websites', 'eagler', 'movies'];

export async function onRequestGet({ env }) {
  try {
    return json(await readEntries(env));
  } catch (error) {
    return json({ error: error.message || 'Could not load entries.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const entries = await readEntries(env);
    if (!body || typeof body.name !== 'string' || !Array.isArray(body.links) || !body.links.length || body.links.length > MAX_LINKS_PER_ENTRY) {
      return json({ error: `Provide an entry name and between 1 and ${MAX_LINKS_PER_ENTRY} links.` }, 400);
    }
    if (entries.length >= MAX_ENTRIES) return json({ error: `The board can contain at most ${MAX_ENTRIES} entries.` }, 400);
    const name = body.name.trim();
    if (!name || name.length > MAX_NAME_LENGTH) return json({ error: `Entry names must contain 1 to ${MAX_NAME_LENGTH} characters.` }, 400);
    if (!CATEGORIES.includes(body.category)) return json({ error: `Category must be one of: ${CATEGORIES.join(', ')}.` }, 400);
    const links = [];
    for (const value of body.links) {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > MAX_URL_LENGTH) {
        return json({ error: `Links must be valid HTTP or HTTPS URLs no longer than ${MAX_URL_LENGTH} characters.` }, 400);
      }
      let url;
      try {
        url = new URL(value.trim());
      } catch {
        return json({ error: 'Each link must be a valid HTTP or HTTPS URL.' }, 400);
      }
      if (!['http:', 'https:'].includes(url.protocol)) return json({ error: 'Each link must use HTTP or HTTPS.' }, 400);
      links.push(url.toString());
    }
    const timestamp = new Date().toISOString();
    const nextEntries = [...entries, {
      id: crypto.randomUUID(),
      name,
      links,
      category: body.category,
      createdAt: timestamp
    }];
    await writeEntries(env, nextEntries);
    return json({ added: 1 });
  } catch (error) {
    return json({ error: error.message || 'Could not add entries.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const entries = await readEntries(env);
    if (body.all === true) {
      await writeEntries(env, []);
      return json({ deleted: entries.length });
    }
    const remaining = entries.filter((entry) => entry.id !== body.id);
    if (remaining.length === entries.length) return json({ error: 'Entry not found.' }, 404);
    await writeEntries(env, remaining);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Could not delete entries.' }, 503);
  }
}