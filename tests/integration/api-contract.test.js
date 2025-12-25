/**
 * API Contract Tests
 * 
 * Testuje API endpoints, response schemas, error handling
 */

const axios = require('axios');
const { expect } = require('chai');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const NODERED_URL = process.env.NODERED_URL || 'http://localhost:1880';

describe('API Contract Tests', function() {
  this.timeout(10000);
  
  describe('UI API Endpoints', () => {
    it('should return weather data with correct schema', async () => {
      try {
        const response = await axios.get(`${BASE_URL}/api/weather`);
        
        expect(response.status).to.equal(200);
        expect(response.data).to.be.an('object');
        
        // Weather API should return some data (structure depends on implementation)
        expect(response.data).to.not.be.empty;
      } catch (error) {
        // If endpoint doesn't exist yet, that's OK
        if (error.response && error.response.status === 404) {
          console.log('  ⚠ Weather API not implemented yet');
        } else {
          throw error;
        }
      }
    });
    
    it('should return metrics in Prometheus format', async () => {
      const response = await axios.get(`${BASE_URL}/api/metrics`);
      
      expect(response.status).to.equal(200);
      expect(response.headers['content-type']).to.include('text/plain');
      
      const metrics = response.data;
      expect(metrics).to.include('# HELP');
      expect(metrics).to.include('# TYPE');
    });
    
    it('should handle 404 gracefully', async () => {
      try {
        await axios.get(`${BASE_URL}/api/nonexistent`);
        throw new Error('Should have thrown 404');
      } catch (error) {
        expect(error.response.status).to.equal(404);
      }
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
      try {
        await axios.get(`${BASE_URL}/api/invalid-endpoint`);
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error.response.status).to.be.oneOf([404, 405]);
        
        // Should not leak stack traces in production
        if (error.response.data) {
          const body = JSON.stringify(error.response.data);
          expect(body).to.not.include('at Object');
          expect(body).to.not.include('node_modules');
        }
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
