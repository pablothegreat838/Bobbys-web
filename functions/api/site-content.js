import { json, requireSameOrigin } from '../_lib/data.js';
import { defaultSiteContent, SITE_TEXT_FIELDS } from '../_lib/site-content.js';

const CONTENT_KEY = 'site-content';
const MAX_TEXT_LENGTH = 2000;

async function readSiteContent(env) {
  if (!env.ENTRIES) throw new Error('The ENTRIES KV binding is not configured.');
  const content = defaultSiteContent();
  const saved = await env.ENTRIES.get(CONTENT_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const field of SITE_TEXT_FIELDS) {
        if (typeof parsed[field.key] === 'string' && parsed[field.key].length <= MAX_TEXT_LENGTH) {
          content[field.key] = parsed[field.key];
        }
      }
    }
  }
  return content;
}

export async function onRequestGet({ env }) {
  try {
    return json({ content: await readSiteContent(env), fields: SITE_TEXT_FIELDS.map(({ key, page, label }) => ({ key, page, label })) });
  } catch (error) {
    return json({ error: error.message || 'Could not load site text.' }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }
  if (!body?.content || typeof body.content !== 'object' || Array.isArray(body.content)) {
    return json({ error: 'Provide site text fields to save.' }, 400);
  }
  const allowedKeys = new Set(SITE_TEXT_FIELDS.map(({ key }) => key));
  for (const [key, value] of Object.entries(body.content)) {
    if (!allowedKeys.has(key) || typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
      return json({ error: 'Text must use an available field and be no longer than 2000 characters.' }, 400);
    }
  }

  try {
    const content = { ...await readSiteContent(env), ...body.content };
    await env.ENTRIES.put(CONTENT_KEY, JSON.stringify(content));
    return json({ content });
  } catch (error) {
    return json({ error: error.message || 'Could not save site text.' }, 503);
  }
}