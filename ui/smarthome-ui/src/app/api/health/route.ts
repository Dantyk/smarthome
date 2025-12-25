import { NextResponse } from 'next/server';
import { getMqttClient } from '@/lib/mqtt';

/**
 * Health Check endpoint pre UI službu
 * 
 * Kontroluje:
 * - Next.js beží
 * - MQTT pripojenie (connected/disconnected)
 * - Environment variables
 */
export async function GET() {
  try {
    const mqttClient = getMqttClient();
    const mqttStatus = mqttClient?.connected ? 'connected' : 'disconnected';
    
    const health = {
      status: mqttStatus === 'connected' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'smarthome-ui',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      checks: {
        nextjs: 'ok',
        env: checkEnv(),
        mqtt: mqttStatus
      }
    };
    
    const statusCode = mqttStatus === 'connected' ? 200 : 503;
    return NextResponse.json(health, { status: statusCode });
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
