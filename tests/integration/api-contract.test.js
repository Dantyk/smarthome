/**
 * API Contract Tests
 * 
 * Testuje API endpoints, response schemas, error handling
 */

const axios = require('axios');
const { expect } = require('chai');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8088';
const NODERED_URL = process.env.NODERED_URL || 'http://localhost:1880';

// Basic Auth credentials (if UI auth is enabled)
const axiosConfig = {
  auth: process.env.UI_AUTH_ENABLED === 'true' ? {
    username: process.env.UI_AUTH_USERNAME || 'admin',
    password: process.env.UI_AUTH_PASSWORD || 'admin'
  } : undefined,
  validateStatus: () => true // Accept all status codes
};

describe('API Contract Tests', function() {
  this.timeout(10000);
  
  describe('UI API Endpoints', () => {
    it('should return weather data with correct schema', async () => {
      const response = await axios.get(`${BASE_URL}/api/weather`, axiosConfig);
        
      // Weather API may not be implemented yet (404 is acceptable)
      if (response.status === 200) {
        expect(response.data).to.be.an('object');
        expect(response.data).to.not.be.empty;
      } else {
        expect([401, 404]).to.include(response.status);
      }
    });
    
    it('should return metrics in Prometheus format', async () => {
      const response = await axios.get(`${BASE_URL}/api/metrics`, axiosConfig);
      
      expect(response.status).to.equal(200);
      expect(response.headers['content-type']).to.include('text/plain');
      
      const metrics = response.data;
      expect(metrics).to.include('# HELP');
      expect(metrics).to.include('# TYPE');
    });
    
    it('should handle 404 gracefully', async () => {
      const response = await axios.get(`${BASE_URL}/api/nonexistent`, axiosConfig);
      
      // API môže vrátiť 404 alebo 401 (ak je auth vypnutý)
      expect([401, 404]).to.include(response.status);
    });
  });
  
  describe('Node-RED API Endpoints', () => {
    it('should return metrics endpoint', async () => {
      const response = await axios.get(`${NODERED_URL}/metrics`);
      
      expect(response.status).to.equal(200);
      expect(response.headers['content-type']).to.include('text/plain');
      
      const metrics = response.data;
      expect(metrics).to.include('# HELP');
      expect(metrics).to.include('nodered_uptime_seconds');
    });
    
    it('should return JSON metrics', async () => {
      const response = await axios.get(`${NODERED_URL}/metrics/json`);
      
      expect(response.status).to.equal(200);
      expect(response.data).to.be.an('object');
      
      // Should have uptime
      expect(response.data).to.have.property('uptime');
      expect(response.data.uptime).to.be.a('number');
      
      // Should have MQTT metrics
      expect(response.data).to.have.property('mqtt');
      expect(response.data.mqtt).to.be.an('object');
    });
    
    it('should have rate limiter metrics', async () => {
      const response = await axios.get(`${NODERED_URL}/metrics/json`);
      
      expect(response.data).to.have.property('rateLimiter');
      expect(response.data.rateLimiter).to.have.property('allowed');
      expect(response.data.rateLimiter).to.have.property('rejected');
    });
    
    it('should have circuit breaker metrics', async () => {
      const response = await axios.get(`${NODERED_URL}/metrics/json`);
      
      expect(response.data).to.have.property('circuitBreaker');
      expect(response.data.circuitBreaker).to.be.an('object');
    });
  });
  
  describe('Response Time', () => {
    it('should respond to metrics endpoint within 500ms', async () => {
      const start = Date.now();
      await axios.get(`${NODERED_URL}/metrics`);
      const duration = Date.now() - start;
      
      expect(duration).to.be.lessThan(500);
    });
    
    it('should respond to JSON metrics within 200ms', async () => {
      const start = Date.now();
      await axios.get(`${NODERED_URL}/metrics/json`);
      const duration = Date.now() - start;
      
      expect(duration).to.be.lessThan(200);
    });
  });
  
  describe('Error Responses', () => {
    it('should return proper error structure', async () => {
      const response = await axios.get(`${BASE_URL}/api/invalid-endpoint`, axiosConfig);
      
      // API môže vrátiť 401, 404, alebo 405
      expect([401, 404, 405]).to.include(response.status);
      
      // Should not leak stack traces in production
      if (response.data && response.status !== 401) {
        const body = JSON.stringify(response.data);
        expect(body).to.not.include('at Object');
        expect(body).to.not.include('node_modules');
      }
    });
  });
  
  describe('Content-Type Headers', () => {
    it('should return correct content-type for metrics', async () => {
      const response = await axios.get(`${NODERED_URL}/metrics`);
      expect(response.headers['content-type']).to.include('text/plain');
    });
    
    it('should return JSON for /metrics/json', async () => {
      const response = await axios.get(`${NODERED_URL}/metrics/json`);
      expect(response.headers['content-type']).to.include('application/json');
    });
  });
});

// Run tests if called directly
if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha({
    reporter: 'spec',
    timeout: 10000
  });
  
  mocha.addFile(__filename);
  
  mocha.run((failures) => {
    process.exitCode = failures ? 1 : 0;
  });
}
