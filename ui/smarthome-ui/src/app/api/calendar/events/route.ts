import { NextRequest, NextResponse } from 'next/server';
import ical from 'node-ical';

/**
 * GET /api/calendar/events
 * Vráti upcoming kalendárne udalosti z Baïkal CalDAV
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
  
  try {
    // Fetch from Baïkal CalDAV
    const baikalUrl = process.env.BAIKAL_CALDAV_URL || 'http://baikal:80/dav.php/calendars/smarthome/default';
    const baikalUser = process.env.BAIKAL_USER || 'smarthome';
    const baikalPassword = process.env.BAIKAL_PASSWORD || 'smarthome';
    
    const auth = Buffer.from(`${baikalUser}:${baikalPassword}`).toString('base64');
    
    const response = await fetch(baikalUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'text/calendar',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Baïkal returned ${response.status}`);
    }
    
    const icalData = await response.text();
    const parsedCal = ical.sync.parseICS(icalData);
    
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    const events = Object.values(parsedCal)
      .filter((event: any) => event.type === 'VEVENT')
      .filter((event: any) => {
        const start = new Date(event.start);
        return start >= now && start <= futureDate;
      })
      .map((event: any) => ({
        summary: event.summary || 'Untitled',
        start: event.start,
        end: event.end,
        description: event.description || '',
        location: event.location || '',
      }))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    return NextResponse.json({
      events,
      sources: ['baikal'],
      days,
      count: events.length
    });
  } catch (error: any) {
    // Fallback: return empty events if CalDAV fails
    return NextResponse.json({
      events: [],
      sources: [],
      days,
      error: `CalDAV fetch failed: ${error.message}`,
      message: 'Calendar integration failed - check Baïkal connection'
    }, { status: 503 });
  }
}
