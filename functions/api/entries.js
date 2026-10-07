import { json, readEntries, releaseExpired, requireSameOrigin, writeEntries } from '../_lib/data.js';

const MAX_ENTRIES = 5000;
const MAX_TEXT_LENGTH = 2000;

export async function onRequestGet({ env }) {
  try {
    const entries = await releaseExpired(env, await readEntries(env));
    return json(entries);
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
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > MAX_ENTRIES) return json({ error: 'Add between 1 and 5,000 entries at a time.' }, 400);
    if (!['blocked', 'unblocked'].includes(body.status)) return json({ error: 'Choose blocked or unblocked status.' }, 400);
    if (entries.length + body.items.length > MAX_ENTRIES) return json({ error: `The board can contain at most ${MAX_ENTRIES} entries.` }, 400);
    if (body.releaseAt && (!Number.isFinite(Date.parse(body.releaseAt)) || Date.parse(body.releaseAt) <= Date.now())) return json({ error: 'Choose a release time in the future.' }, 400);
    const added = body.items.map((text) => String(text).trim()).filter(Boolean);
    if (!added.length || added.some((text) => text.length > MAX_TEXT_LENGTH)) return json({ error: 'Entries must contain text and be no longer than 2,000 characters.' }, 400);
    const timestamp = new Date().toISOString();
    const nextEntries = [...entries, ...added.map((text) => ({
      id: crypto.randomUUID(),
      text,
      status: body.status,
      releaseAt: body.status === 'blocked' ? body.releaseAt || null : null,
      createdAt: timestamp
    }))];
    await writeEntries(env, nextEntries);
    return json({ added: added.length });
  } catch (error) {
    return json({ error: error.message || 'Could not add entries.' }, 503);
  }
}

export async function onRequestPatch({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const entries = await readEntries(env);
    const index = entries.findIndex((entry) => entry.id === body.id);
    if (index < 0) return json({ error: 'Entry not found.' }, 404);
    const current = entries[index];
    const status = body.status === undefined ? current.status : body.status;
    const releaseAt = body.releaseAt === undefined ? current.releaseAt : body.releaseAt;
    if (!['blocked', 'unblocked'].includes(status)) return json({ error: 'Choose blocked or unblocked status.' }, 400);
    if (releaseAt && (!Number.isFinite(Date.parse(releaseAt)) || Date.parse(releaseAt) <= Date.now())) return json({ error: 'Choose a release time in the future.' }, 400);
    entries[index] = { ...current, status, releaseAt: status === 'blocked' ? releaseAt || null : null };
    await writeEntries(env, entries);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || 'Could not update the entry.' }, 503);
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