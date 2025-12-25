import { z } from 'zod';

/**
 * Environment Variable Schema & Validation
 * 
 * Validates all required environment variables on startup.
 * Fails fast if config is invalid.
 */

const envSchema = z.object({
  // Node.js
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('production'),
  
  // MQTT (optional pre build time, required pre runtime)
  MQTT_BROKER_URL: z.string().optional().default('ws://localhost:9001'),
  
  // APIs (optional for dev)
  GOOGLE_CALENDAR_API_KEY: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  
  // Notifications (optional)
  PUSHOVER_USER: z.string().optional(),
  PUSHOVER_TOKEN: z.string().optional(),
  
  // Feature flags
  ENABLE_CALENDAR_SYNC: z.boolean().default(true),
  ENABLE_WEATHER_SYNC: z.boolean().default(true),
  ENABLE_NOTIFICATIONS: z.boolean().default(false),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_CONSOLE_LOGS: z.boolean().default(true),
  
  // UI
  NEXT_PUBLIC_TZ: z.string().default('Europe/Bratislava'),
  NEXT_PUBLIC_LOCATION: z.string().default('Bratislava, SK')
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  
  try {
    // Parse and validate
    cachedEnv = envSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      MQTT_BROKER_URL: process.env.MQTT_BROKER_URL,
      GOOGLE_CALENDAR_API_KEY: process.env.GOOGLE_CALENDAR_API_KEY,
      GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
      PUSHOVER_USER: process.env.PUSHOVER_USER,
      PUSHOVER_TOKEN: process.env.PUSHOVER_TOKEN,
      ENABLE_CALENDAR_SYNC: process.env.ENABLE_CALENDAR_SYNC === 'true',
      ENABLE_WEATHER_SYNC: process.env.ENABLE_WEATHER_SYNC === 'true',
      ENABLE_NOTIFICATIONS: process.env.ENABLE_NOTIFICATIONS === 'true',
      LOG_LEVEL: process.env.LOG_LEVEL,
      ENABLE_CONSOLE_LOGS: process.env.ENABLE_CONSOLE_LOGS !== 'false',
      NEXT_PUBLIC_TZ: process.env.NEXT_PUBLIC_TZ,
      NEXT_PUBLIC_LOCATION: process.env.NEXT_PUBLIC_LOCATION
    });
    
    console.log('[ENV] Environment validated successfully');
    return cachedEnv;
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[ENV] Invalid environment variables:');
      err.errors.forEach(e => {
        console.error(`  - ${e.path.join('.')}: ${e.message}`);
      });
      throw new Error('Environment validation failed');
    }
    throw err;
  }
}

// Auto-validate on import (only in runtime, not during build)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    getEnv();
  } catch (err) {
    console.error('[ENV] Validation failed on module load:', err);
  }
}
