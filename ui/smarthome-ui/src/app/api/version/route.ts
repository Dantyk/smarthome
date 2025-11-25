import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Get build timestamp from package.json or build artifact
let buildTimestamp: string | null = null;

function getBuildTimestamp(): string {
  if (buildTimestamp) return buildTimestamp;
  
  try {
    // Try to read from .next/BUILD_ID
    const buildIdPath = path.join(process.cwd(), '.next', 'BUILD_ID');
    if (fs.existsSync(buildIdPath)) {
      buildTimestamp = fs.readFileSync(buildIdPath, 'utf-8').trim();
      return buildTimestamp;
    }
  } catch (err) {
    console.error('[Version] Failed to read BUILD_ID:', err);
  }
  
  // Fallback to current timestamp
  buildTimestamp = Date.now().toString();
  return buildTimestamp;
}

export async function GET(request: NextRequest) {
  const version = getBuildTimestamp();
  
  return NextResponse.json({
    version,
    timestamp: new Date().toISOString(),
  });
}
