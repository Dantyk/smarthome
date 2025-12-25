import { NextRequest, NextResponse } from 'next/server';
import { publish } from '@/lib/mqtt';

type RouteParams = {
  params: {
    room: string;
  };
};

/**
 * GET /api/rooms/[room]
 * Vráti detail konkrétnej miestnosti
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { room } = params;
  
  // Validate room name
  const validRooms = ['spalna', 'detska', 'obyvacka', 'kuchyna', 'kupelna'];
  if (!validRooms.includes(room)) {
    return NextResponse.json(
      { error: 'Invalid room name' },
      { status: 400 }
    );
  }
  
  // In production, fetch from MQTT retained messages or cache
  return NextResponse.json({
    room,
    message: 'Use MQTT subscriptions for real-time data'
  });
}

/**
 * PATCH /api/rooms/[room]
 * Aktualizuje nastavenia miestnosti
 * Body: { target_temp?: number, enabled?: boolean, boost?: { minutes: number, target_temp: number } }
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { room } = params;
  
  // Validate room name
  const validRooms = ['spalna', 'detska', 'obyvacka', 'kuchyna', 'kupelna'];
  if (!validRooms.includes(room)) {
    return NextResponse.json(
      { error: 'Invalid room name' },
      { status: 400 }
    );
  }
  
  try {
    const body = await request.json();
    
    // Validate and publish commands
    if (body.target_temp !== undefined) {
      const temp = parseFloat(body.target_temp);
      if (isNaN(temp) || temp < 10 || temp > 30) {
        return NextResponse.json(
          { error: 'Invalid temperature (must be 10-30°C)' },
          { status: 400 }
        );
      }
      
      publish(`cmd/room/${room}/set_target`, {
        value: temp,
        source: 'api',
        trace_id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      });
    }
    
    if (body.enabled !== undefined) {
      publish(`virt/room/${room}/enabled`, body.enabled ? 'true' : 'false');
    }
    
    if (body.boost) {
      const { minutes, target_temp } = body.boost;
      if (minutes && minutes > 0) {
        publish(`virt/boost/${room}/minutes`, minutes.toString());
      }
      if (target_temp) {
        publish(`virt/boost/${room}/target_temp`, target_temp.toString());
      }
    }
    
    return NextResponse.json({
      success: true,
      room,
      updated: Object.keys(body)
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request body', message: error.message },
      { status: 400 }
    );
  }
}
