/**
 * MQTT Integration Tests
 * 
 * Testuje MQTT message flow, topic routing, retained messages
 */

const mqtt = require('mqtt');
const { expect } = require('chai');

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const TEST_TIMEOUT = 10000;

describe('MQTT Integration Tests', function() {
  this.timeout(TEST_TIMEOUT);
  
  let client;
  
  beforeEach((done) => {
    client = mqtt.connect(MQTT_BROKER, {
      clientId: `test-${Date.now()}`,
      clean: true
    });
    
    client.on('connect', () => done());
    client.on('error', done);
  });
  
  afterEach((done) => {
    if (client) {
      client.end(false, () => done());
    } else {
      done();
    }
  });
  
  describe('Connection', () => {
    it('should connect to MQTT broker', (done) => {
      expect(client.connected).to.be.true;
      done();
    });
    
    it('should support QoS levels', (done) => {
      const topic = 'test/qos';
      
      client.subscribe(topic, { qos: 1 }, (err) => {
        expect(err).to.be.null;
        
        client.publish(topic, 'test', { qos: 1 }, (err) => {
          expect(err).to.be.null;
          done();
        });
      });
    });
  });
  
  describe('Topic Routing', () => {
    it('should publish and receive on cmd topic', (done) => {
      const topic = 'cmd/test/light';
      const payload = JSON.stringify({ state: 'on' });
      
      client.subscribe(topic, (err) => {
        expect(err).to.be.null;
        
        client.on('message', (receivedTopic, message) => {
          if (receivedTopic === topic) {
            expect(message.toString()).to.equal(payload);
            done();
          }
        });
        
        setTimeout(() => {
          client.publish(topic, payload);
        }, 100);
      });
    });
    
    it('should route stat topic correctly', (done) => {
      const topic = 'stat/living_room/temperature';
      const payload = '22.5';
      
      client.subscribe(topic, (err) => {
        expect(err).to.be.null;
        
        client.on('message', (receivedTopic, message) => {
          if (receivedTopic === topic) {
            expect(message.toString()).to.equal(payload);
            done();
          }
        });
        
        setTimeout(() => {
          client.publish(topic, payload, { qos: 0 });
        }, 100);
      });
    });
    
    it('should support wildcard subscriptions', (done) => {
      const pattern = 'test/wildcard/#';
      const topic1 = 'test/wildcard/a';
      const topic2 = 'test/wildcard/b/c';
      
      let received = 0;
      
      client.subscribe(pattern, (err) => {
        expect(err).to.be.null;
        
        client.on('message', (receivedTopic) => {
          if (receivedTopic.startsWith('test/wildcard/')) {
            received++;
            if (received === 2) {
              done();
            }
          }
        });
        
        setTimeout(() => {
          client.publish(topic1, 'msg1');
          client.publish(topic2, 'msg2');
        }, 100);
      });
    });
  });
  
  describe('Retained Messages', () => {
    it('should receive retained messages on subscribe', (done) => {
      const topic = 'test/retained';
      const payload = 'retained-message';
      
      // Publish retained message
      client.publish(topic, payload, { retain: true }, (err) => {
        expect(err).to.be.null;
        
        // Create new client to test retained
        const client2 = mqtt.connect(MQTT_BROKER, {
          clientId: `test-retained-${Date.now()}`
        });
        
        client2.on('connect', () => {
          client2.subscribe(topic, (err) => {
            expect(err).to.be.null;
          });
          
          client2.on('message', (receivedTopic, message, packet) => {
            if (receivedTopic === topic) {
              expect(message.toString()).to.equal(payload);
              expect(packet.retain).to.be.true;
              
              client2.end();
              
              // Clean up retained message
              client.publish(topic, '', { retain: true }, () => {
                done();
              });
            }
          });
        });
      });
    });
  });
  
  describe('Message Flow', () => {
    it('should handle rapid message publishing', (done) => {
      const topic = 'test/rapid';
      const messageCount = 100;
      let received = 0;
      
      client.subscribe(topic, (err) => {
        expect(err).to.be.null;
        
        client.on('message', (receivedTopic) => {
          if (receivedTopic === topic) {
            received++;
            if (received === messageCount) {
              done();
            }
          }
        });
        
        setTimeout(() => {
          for (let i = 0; i < messageCount; i++) {
            client.publish(topic, `msg-${i}`, { qos: 0 });
          }
        }, 100);
      });
    });
    
    it('should handle large payloads', (done) => {
      const topic = 'test/large';
      const payload = 'x'.repeat(8192); // 8KB payload
      
      client.subscribe(topic, (err) => {
        expect(err).to.be.null;
        
        client.on('message', (receivedTopic, message) => {
          if (receivedTopic === topic) {
            expect(message.toString()).to.equal(payload);
            done();
          }
        });
        
        setTimeout(() => {
          client.publish(topic, payload);
        }, 100);
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle publish to invalid topic gracefully', (done) => {
      const invalidTopic = ''; // Empty topic
      
      client.publish(invalidTopic, 'test', (err) => {
        // Should get error for invalid topic
        expect(err).to.not.be.null;
        done();
      });
    });
    
    it('should reconnect after disconnect', function(done) {
      this.timeout(15000);
      
      let reconnected = false;
      
      client.on('reconnect', () => {
        reconnected = true;
      });
      
      client.on('connect', () => {
        if (reconnected) {
          done();
        }
      });
      
      // Force disconnect
      client.stream.destroy();
    });
  });
});

// Run tests if called directly
if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha({
    reporter: 'spec',
    timeout: TEST_TIMEOUT
  });
  
  mocha.addFile(__filename);
  
  mocha.run((failures) => {
    process.exitCode = failures ? 1 : 0;
  });
}
