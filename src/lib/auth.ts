import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getEnv } from '@/lib/env';

const COOKIE_NAME = 'imigra_admin_session';

type SessionPayload = {
  email: string;
  exp: number; // unix seconds
};

function b64urlEncode(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(str: string) {
  const pad = 4 - (str.length % 4 || 4);
  const padded = str + '='.repeat(pad === 4 ? 0 : pad);
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function getSessionSecret() {
  const env = getEnv();
  return env.ADMIN_SESSION_SECRET ?? env.ADMIN_LOGIN_PASSWORD;
}

function sign(payloadB64: string) {
  const h = crypto.createHmac('sha256', getSessionSecret());
  h.update(payloadB64);
  return b64urlEncode(h.digest());
}

export function setAdminSession(email: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12; // 12h
  const payload: SessionPayload = { email, exp };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const token = `${payloadB64}.${sign(payloadB64)}`;

  return cookies().then((store) =>
    store.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 12,
    })
  );
}

export function clearAdminSession() {
  return cookies().then((store) =>
    store.set(COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
      maxAge: 0,
    })
  );
}

export async function getAdminSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  if (!timingSafeEqual(expected, sig)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload?.email || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) return null;

  const env = getEnv();
  if (session.email.toLowerCase() !== env.ADMIN_LOGIN_EMAIL.toLowerCase()) return null;
  return session;
}
