import { json, requireSameOrigin } from '../_lib/data.js';

const ANNOUNCEMENT_KEY = 'announcement';
const MAX_MESSAGE_LENGTH = 500;

export async function onRequestGet({ env }) {
  try {
    if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
    const saved = await env.ENTRIES.get(ANNOUNCEMENT_KEY);
    if (!saved) return json({ announcement: null });
    const announcement = JSON.parse(saved);
    if (typeof announcement?.message !== 'string' || typeof announcement?.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(announcement.expiresAt)) || Date.parse(announcement.expiresAt) <= Date.now()) {
      return json({ announcement: null });
    }
    return json({ announcement });
  } catch (error) {
    return json({ error: error.message || 'Could not load the announcement.' }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const expiresAt = typeof body?.expiresAt === 'string' ? new Date(body.expiresAt) : null;
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return json({ error: `Announcements must contain 1 to ${MAX_MESSAGE_LENGTH} characters.` }, 400);
    }
    if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return json({ error: 'Choose a valid future expiry date and time.' }, 400);
    }
    if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
    const announcement = { message, expiresAt: expiresAt.toISOString(), updatedAt: new Date().toISOString() };
    await env.ENTRIES.put(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
    return json({ announcement });
  } catch (error) {
    return json({ error: error.message || 'Could not save the announcement.' }, 503);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  try {
    if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
    await env.ENTRIES.delete(ANNOUNCEMENT_KEY);
    return json({ announcement: null });
  } catch (error) {
    return json({ error: error.message || 'Could not remove the announcement.' }, 503);
  }
}