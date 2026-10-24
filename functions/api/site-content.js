import { json, requireSameOrigin } from '../_lib/data.js';
import { defaultSiteContent, SITE_TEXT_FIELDS, SITE_THEMES } from '../_lib/site-content.js';

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
      if (SITE_THEMES.some(({ id }) => id === parsed.theme)) content.theme = parsed.theme;
      if (typeof parsed.siteTitle === 'string' && parsed.siteTitle.length <= 120) content.siteTitle = parsed.siteTitle;
      if (typeof parsed.favicon === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(parsed.favicon)) content.favicon = parsed.favicon;
    }
  }
  return content;
}

export async function onRequestGet({ env }) {
  try {
    return json({
      content: await readSiteContent(env),
      fields: SITE_TEXT_FIELDS.map(({ key, page, label }) => ({ key, page, label })),
      themes: SITE_THEMES
    });
  } catch (error) {
    return json({ error: 'Could not load site text.' }, 503);
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
  const allowedKeys = new Set([...SITE_TEXT_FIELDS.map(({ key }) => key), 'theme', 'siteTitle', 'favicon']);
  for (const [key, value] of Object.entries(body.content)) {
    const validValue = typeof value === 'string' && (key === 'theme'
      ? SITE_THEMES.some(({ id }) => id === value)
      : key === 'siteTitle'
        ? value.length <= 120
        : key === 'favicon'
          ? value === '' || /^[a-zA-Z0-9_-]{1,80}$/.test(value)
          : value.length <= MAX_TEXT_LENGTH);
    if (!allowedKeys.has(key) || !validValue) {
      return json({ error: 'Use an available text field, a supported theme, a title up to 120 characters, or a valid favicon version.' }, 400);
    }
  }

  try {
    const content = { ...await readSiteContent(env), ...body.content };
    await env.ENTRIES.put(CONTENT_KEY, JSON.stringify(content));
    return json({ content });
  } catch (error) {
    return json({ error: 'Could not save site text.' }, 503);
  }
}