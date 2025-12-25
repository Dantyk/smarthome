/**
 * K6 Load Test - API Stress Test
 * 
 * Testuje Next.js UI API endpoints pod záťažou.
 * 
 * Usage:
 *   k6 run api-stress.js
 *   k6 run --vus 100 --duration 3m api-stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Warm up
    { duration: '1m', target: 50 },    // Normal load
    { duration: '2m', target: 100 },   // High load
    { duration: '1m', target: 200 },   // Stress test
    { duration: '30s', target: 0 },    // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],  // 95% under 2s, 99% under 5s
    'http_req_failed': ['rate<0.05'],                   // Error rate < 5%
    'api_response_time': ['p(95)<1000'],                // API calls under 1s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics
const apiResponseTime = new Trend('api_response_time');
const apiErrors = new Rate('api_errors');

export default function () {
  // Test 1: Homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status 200': (r) => r.status === 200,
    'homepage has content': (r) => r.body.includes('SmartHome'),
  });
  apiResponseTime.add(res.timings.duration);
  apiErrors.add(res.status !== 200);
  
  sleep(1);

  // Test 2: Weather API
  res = http.get(`${BASE_URL}/api/weather`);
  check(res, {
    'weather API status 200': (r) => r.status === 200,
    'weather API returns JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });
  apiResponseTime.add(res.timings.duration);
  apiErrors.add(res.status !== 200);

  sleep(1);

  // Test 3: Metrics endpoint
  res = http.get(`${BASE_URL}/api/metrics`);
  check(res, {
    'metrics endpoint status 200': (r) => r.status === 200,
    'metrics returns prometheus format': (r) => r.body.includes('# HELP'),
  });
  apiResponseTime.add(res.timings.duration);
  apiErrors.add(res.status !== 200);

  sleep(1);

  // Test 4: Static assets
  res = http.get(`${BASE_URL}/_next/static/css/app/layout.css`, {
    tags: { name: 'static_asset' },
  });
  check(res, {
    'static asset loads': (r) => r.status === 200 || r.status === 304,
  });

  sleep(Math.random() * 2); // Random sleep 0-2s
}

export function handleSummary(data) {
  return {
    'load-test-api-results.json': JSON.stringify(data, null, 2),
    'load-test-api-results.html': htmlReport(data),
    stdout: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API Stress Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Requests:    ${data.metrics.http_reqs.values.count}
Failed Requests:   ${data.metrics.http_req_failed.values.passes} (${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%)
Requests/sec:      ${data.metrics.http_reqs.values.rate.toFixed(2)}

Response Time (ms):
  min:  ${data.metrics.http_req_duration.values.min.toFixed(2)}
  p50:  ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}
  p90:  ${data.metrics.http_req_duration.values['p(90)'].toFixed(2)}
  p95:  ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}
  p99:  ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}
  max:  ${data.metrics.http_req_duration.values.max.toFixed(2)}

API Response Time (ms):
  p50:  ${data.metrics.api_response_time.values['p(50)'].toFixed(2)}
  p95:  ${data.metrics.api_response_time.values['p(95)'].toFixed(2)}
  p99:  ${data.metrics.api_response_time.values['p(99)'].toFixed(2)}

Virtual Users:
  min:  ${data.metrics.vus.values.min}
  max:  ${data.metrics.vus.values.max}

Data Transferred:  ${(data.metrics.data_received.values.count / 1024 / 1024).toFixed(2)} MB

Thresholds:
${Object.entries(data.thresholds || {}).map(([name, result]) => 
  `  ${result.ok ? '✓' : '✗'} ${name}`
).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`,
  };
}

function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>K6 Load Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <h1>SmartHome API Load Test Report</h1>
  <p><strong>Date:</strong> ${new Date().toISOString()}</p>
  
  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Requests</td><td>${data.metrics.http_reqs.values.count}</td></tr>
    <tr><td>Failed Requests</td><td>${data.metrics.http_req_failed.values.passes} (${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%)</td></tr>
    <tr><td>Requests/sec</td><td>${data.metrics.http_reqs.values.rate.toFixed(2)}</td></tr>
    <tr><td>p95 Response Time</td><td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)} ms</td></tr>
    <tr><td>p99 Response Time</td><td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)} ms</td></tr>
    <tr><td>Max VUs</td><td>${data.metrics.vus.values.max}</td></tr>
  </table>
  
  <h2>Thresholds</h2>
  <table>
    <tr><th>Threshold</th><th>Status</th></tr>
    ${Object.entries(data.thresholds || {}).map(([name, result]) => 
      `<tr><td>${name}</td><td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'PASS' : 'FAIL'}</td></tr>`
    ).join('\n')}
  </table>
</body>
</html>
`;
}
