import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/calendar/events
 * Vráti upcoming kalendárne udalosti
 * Query params: ?days=7 (default)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get('days') || '7');
  
  if (isNaN(days) || days < 1 || days > 90) {
    return NextResponse.json(
      { error: 'Invalid days parameter (1-90)' },
      { status: 400 }
    );
  }
  
  // TODO: Fetch from Baikal CalDAV and Google Calendar
  // For now, return placeholder
  return NextResponse.json({
    events: [],
    sources: ['baikal', 'google'],
    days,
    message: 'Calendar integration pending'
  });
}
