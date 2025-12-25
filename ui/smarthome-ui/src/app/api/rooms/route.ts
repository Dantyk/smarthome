import { NextRequest, NextResponse } from 'next/server';
import { publish, getMqtt } from '@/lib/mqtt';

/**
 * GET /api/rooms
 * Vráti zoznam všetkých miestností s ich aktuálnym stavom
 */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`http://localhost:3000/api/modes`);
    if (!response.ok) {
      throw new Error('Failed to fetch modes config');
    }
    
    const config = await response.json();
    
    // Return room list with capabilities
    return NextResponse.json({
      rooms: config.rooms || [],
      capabilities: config.room_capabilities || {},
      labels: config.room_labels || {},
      icons: config.room_icons || {}
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch rooms', message: error.message },
      { status: 500 }
    );
  }
}
