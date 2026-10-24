interface Env {
  UPLOAD_SECRET?: string;
  LOGO_BUCKET?: {
    put(
      key: string,
      value: string,
      options?: { httpMetadata?: { contentType?: string } }
    ): Promise<unknown>;
  };
}

interface PagesContext {
  request: Request;
  env: Env;
}

const MAX_SVG_SIZE = 100_000;
const UNSAFE_SVG = /<\s*(?:script|style|foreignObject|iframe|object|embed|audio|video|image|use|animate|set)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html|<!DOCTYPE|<!ENTITY|\b(?:href|style)\s*=|url\s*\(/i;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function onRequest({ request, env }: PagesContext): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object') {
    return json({ error: 'Invalid request body' }, 400);
  }

  const payload = body as Record<string, unknown>;
  if (!env.UPLOAD_SECRET) {
    return json({ error: 'Upload service is not configured' }, 503);
  }
  if (payload.secret !== env.UPLOAD_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (typeof payload.name !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(payload.name) ||
    typeof payload.svg !== 'string' || payload.svg.length > MAX_SVG_SIZE || UNSAFE_SVG.test(payload.svg)) {
    return json({ error: 'name and svg must be strings' }, 400);
  }
  if (!env.LOGO_BUCKET) {
    return json({ error: 'LOGO_BUCKET binding is not configured' }, 503);
  }

  try {
    await env.LOGO_BUCKET.put(`logos/${payload.name}.svg`, payload.svg, {
      httpMetadata: { contentType: 'image/svg+xml; charset=utf-8' }
    });
    return json({ success: true, message: 'Logo uploaded' });
  } catch {
    return json({ error: 'Could not upload logo' }, 500);
  }
}