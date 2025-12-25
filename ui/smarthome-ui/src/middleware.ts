import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Basic Authentication Middleware (LAN-only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const UI_AUTH_ENABLED = process.env.UI_AUTH_ENABLED === 'true';
const UI_AUTH_USERNAME = process.env.UI_AUTH_USERNAME || 'admin';
const UI_AUTH_PASSWORD_HASH = process.env.UI_AUTH_PASSWORD_HASH || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || '86400', 10); // 24h default

/**
 * Hash password with SHA-256
 * (Simple for LAN-only, use bcrypt for production)
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Create session cookie
 */
function createSessionCookie(): string {
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const payload = JSON.stringify({
    user: UI_AUTH_USERNAME,
    expires: expires.getTime(),
  });
  
  // Simple session token (use JWT for production)
  const token = Buffer.from(payload).toString('base64');
  
  return `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

/**
 * Verify session cookie
 */
function verifySession(cookie: string | undefined): boolean {
  if (!cookie) return false;
  
  try {
    const match = cookie.match(/session=([^;]+)/);
    if (!match) return false;
    
    const token = match[1];
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check expiration
    if (Date.now() > payload.expires) {
      return false;
    }
    
    return payload.user === UI_AUTH_USERNAME;
  } catch {
    return false;
  }
}

/**
 * Parse Basic Auth header
 */
function parseBasicAuth(header: string | null): { username: string; password: string } | null {
  if (!header || !header.startsWith('Basic ')) {
    return null;
  }
  
  try {
    const base64 = header.substring(6);
    const decoded = Buffer.from(base64, 'base64').toString();
    const [username, password] = decoded.split(':');
    
    return { username, password };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  // Skip auth if disabled
  if (!UI_AUTH_ENABLED) {
    return NextResponse.next();
  }
  
  // Skip auth for API routes (they have their own protection)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Check session cookie first
  const cookieHeader = request.headers.get('cookie');
  if (verifySession(cookieHeader)) {
    return NextResponse.next();
  }
  
  // Check Basic Auth header
  const authHeader = request.headers.get('authorization');
  const credentials = parseBasicAuth(authHeader);
  
  if (credentials) {
    const { username, password } = credentials;
    const passwordHash = hashPassword(password);
    
    // Verify credentials
    if (username === UI_AUTH_USERNAME && passwordHash === UI_AUTH_PASSWORD_HASH) {
      // Create session cookie
      const response = NextResponse.next();
      response.headers.set('Set-Cookie', createSessionCookie());
      return response;
    }
  }
  
  // Request authentication
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="SmartHome UI"',
    },
  });
}

// Apply to all routes except static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
