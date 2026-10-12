import { json, requireSameOrigin } from '../_lib/data.js';

const OBJECT_KEY = /^movies\/[0-9a-f-]{36}\/(video|poster)$/i;

function validKey(key, kind) {
  return typeof key === 'string' && OBJECT_KEY.test(key) && key.endsWith(`/${kind}`);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env }) {
  const denied = requireSameOrigin(request);
  if (denied) return denied;
  if (!env.MOVIES) return json({ error: 'The MOVIES R2 bucket binding is not configured.' }, 503);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (action === 'part') {
    const key = url.searchParams.get('key');
    const uploadId = url.searchParams.get('uploadId');
    const partNumber = Number(url.searchParams.get('partNumber'));
    if (!OBJECT_KEY.test(key || '') || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 || !request.body) {
      return json({ error: 'Invalid upload part.' }, 400);
    }
    try {
      const upload = env.MOVIES.resumeMultipartUpload(key, uploadId);
      const part = await upload.uploadPart(partNumber, request.body);
      return json({ partNumber, etag: part.etag });
    } catch (error) {
      return json({ error: error.message || 'Could not upload this file part.' }, 503);
    }
  }

  const body = await readJson(request);
  if (!body) return json({ error: 'Request body must be valid JSON.' }, 400);

  if (action === 'init') {
    const kind = body.kind;
    const contentType = typeof body.contentType === 'string' ? body.contentType : '';
    if (!['video', 'poster'].includes(kind) || !contentType.startsWith(kind === 'video' ? 'video/' : 'image/')) {
      return json({ error: kind === 'video' ? 'Choose a video file.' : 'Choose an image file.' }, 400);
    }
    try {
      const key = `movies/${crypto.randomUUID()}/${kind}`;
      const upload = await env.MOVIES.createMultipartUpload(key, { httpMetadata: { contentType } });
      return json({ key, uploadId: upload.uploadId });
    } catch (error) {
      return json({ error: error.message || 'Could not start the upload.' }, 503);
    }
  }

  if (!validKey(body.key, body.kind)) return json({ error: 'Invalid upload key.' }, 400);
  if (action === 'delete') {
    try {
      await env.MOVIES.delete(body.key);
      return json({ ok: true });
    } catch (error) {
      return json({ error: error.message || 'Could not remove the uploaded file.' }, 503);
    }
  }
  if (!body.uploadId) return json({ error: 'Missing upload id.' }, 400);

  try {
    const upload = env.MOVIES.resumeMultipartUpload(body.key, body.uploadId);
    if (action === 'complete') {
      if (!Array.isArray(body.parts) || !body.parts.length || body.parts.some((part) => !Number.isInteger(part.partNumber) || typeof part.etag !== 'string')) {
        return json({ error: 'Upload parts are incomplete.' }, 400);
      }
      const object = await upload.complete(body.parts);
      return json({ key: object.key });
    }
    if (action === 'abort') {
      await upload.abort();
      return json({ ok: true });
    }
    return json({ error: 'Unknown upload action.' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Could not finish the upload.' }, 503);
  }
}