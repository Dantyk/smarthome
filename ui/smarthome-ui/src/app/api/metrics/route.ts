import { NextResponse } from 'next/server';
import { metrics } from '@/lib/metrics';

/**
 * Prometheus Metrics Endpoint pre UI
 * 
 * Exportuje metriky v Prometheus formáte.
 */

export async function GET() {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  
  const prometheusMetrics = `
# HELP smarthome_ui_uptime_seconds UI uptime in seconds
# TYPE smarthome_ui_uptime_seconds counter
smarthome_ui_uptime_seconds ${uptime.toFixed(2)}

# HELP smarthome_ui_http_requests_total Total HTTP requests
# TYPE smarthome_ui_http_requests_total counter
smarthome_ui_http_requests_total ${metrics.httpRequests}

# HELP smarthome_ui_mqtt_messages_total Total MQTT messages
# TYPE smarthome_ui_mqtt_messages_total counter
smarthome_ui_mqtt_messages_total ${metrics.mqttMessages}

# HELP smarthome_ui_mqtt_errors_total Total MQTT errors
# TYPE smarthome_ui_mqtt_errors_total counter
smarthome_ui_mqtt_errors_total ${metrics.mqttErrors}

# HELP smarthome_ui_api_errors_total Total API errors
# TYPE smarthome_ui_api_errors_total counter
smarthome_ui_api_errors_total ${metrics.apiErrors}
`.trim();

  return new NextResponse(prometheusMetrics, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4'
    }
  });
}
