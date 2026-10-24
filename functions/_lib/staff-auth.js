import { json } from './data.js';

const SESSION_COOKIE = 'bobbys_staff_session';
const SESSION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(env) {
  if (typeof env.STAFF_SESSION_SECRET !== 'string' || env.STAFF_SESSION_SECRET.length < 32) return null;
  return crypto.subtle.importKey('raw', encoder.encode(env.STAFF_SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(value, key) {
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

function cookieValue(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] || '';
}

export function sessionCookie(request, token, maxAge = SESSION_SECONDS) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

export async function createSession(env) {
  const key = await signingKey(env);
  if (!key) return null;
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000 })));
  return `${payload}.${await sign(payload, key)}`;
}

export async function hasStaffSession(request, env) {
  const key = await signingKey(env);
  const token = cookieValue(request);
  if (!key || !token) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  try {
    const valid = await crypto.subtle.verify('HMAC', key, decodeBase64Url(signature), encoder.encode(payload));
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return Number.isFinite(session.exp) && session.exp > Date.now();
  } catch {
    return false;
  }
}

export async function requireStaff(request, env) {
  if (!env.STAFF_SESSION_SECRET || env.STAFF_SESSION_SECRET.length < 32) {
    return json({ error: 'Staff authentication is not configured.' }, 503);
  }
  return await hasStaffSession(request, env) ? null : json({ error: 'Staff login required.' }, 401);
}

export async function verifyStaffPassword(password, env) {
  const configuredPassword = env.STAFF_PASSWORD;
  if (typeof configuredPassword !== 'string' || !configuredPassword || typeof password !== 'string' || password.length !== configuredPassword.length) return false;
  const supplied = encoder.encode(password);
  const expected = encoder.encode(configuredPassword);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= supplied[index] ^ expected[index];
  return difference === 0;
}