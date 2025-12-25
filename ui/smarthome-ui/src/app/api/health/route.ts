import { NextResponse } from 'next/server';

/**
 * Health Check endpoint pre UI službu
 * 
 * Kontroluje:
 * - Next.js beží
 * - MQTT pripojenie (optional check)
 * - Environment variables
 */
export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'smarthome-ui',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      checks: {
        nextjs: 'ok',
        env: checkEnv(),
        mqtt: 'not_implemented' // TODO: Implement MQTT connection check
      }
    };
    
    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 503 }
    );
  }
}

function checkEnv(): string {
  const required = ['MQTT_BROKER_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return `missing: ${missing.join(', ')}`;
  }
  
  return 'ok';
}
