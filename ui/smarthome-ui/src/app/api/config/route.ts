import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:8088';
  const hostname = host.split(':')[0];
  
  return NextResponse.json({
    mqtt: `ws://${hostname}:9001`,
    api: `http://${hostname}:1880`,
  });
}
