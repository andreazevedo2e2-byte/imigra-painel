import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = new Set(['/login']);

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.has(pathname);
}

function b64urlToBytes(input: string) {
  const padLen = (4 - (input.length % 4 || 4)) % 4;
  const padded = input + '='.repeat(padLen);
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: ArrayBuffer) {
  const u8 = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function isValidSessionToken(token: string) {
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;

  const secret =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_LOGIN_PASSWORD ||
    '';
  const adminEmail = (process.env.ADMIN_LOGIN_EMAIL || '').toLowerCase();
  if (!secret || !adminEmail) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const expectedBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64)
  );
  const expected = bytesToB64url(expectedBuf);
  if (expected !== sig) return false;

  // Validate payload (email + exp).
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(payloadB64))
    ) as { email?: string; exp?: number };
    if (!payload?.email || typeof payload.exp !== 'number') return false;
    if (payload.email.toLowerCase() !== adminEmail) return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get('imigra_admin_session')?.value;
  if (!token || !(await isValidSessionToken(token))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
