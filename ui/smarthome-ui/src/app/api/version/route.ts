import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getBuildTimestamp(): string {
  try {
    // Always read fresh from .next/BUILD_ID (no caching)
    const buildIdPath = path.join(process.cwd(), '.next', 'BUILD_ID');
    if (fs.existsSync(buildIdPath)) {
      const buildId = fs.readFileSync(buildIdPath, 'utf-8').trim();
      return buildId;
    }
  } catch (err) {
    console.error('[Version] Failed to read BUILD_ID:', err);
  }
  
  // Fallback to package.json mtime as version
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const stats = fs.statSync(pkgPath);
    return stats.mtime.getTime().toString();
  } catch (err) {
    console.error('[Version] Failed to read package.json mtime:', err);
  }
  
  return 'unknown';
}

export async function GET(request: NextRequest) {
  const version = getBuildTimestamp();
  
  return NextResponse.json(
    {
      version,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}
