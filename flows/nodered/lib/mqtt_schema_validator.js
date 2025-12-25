/**
 * MQTT Message Schema Validator for Node-RED
 * 
 * Usage:
 * 1. Add as function node in flows
 * 2. Input: msg with topic and payload
 * 3. Output: validated msg or sends to error output
 * 
 * This can be imported as a Node-RED function or converted to a custom node.
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');

// Initialize validator (do this once, store in flow context)
let ajv = flow.get('mqtt_validator');
if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    
    // Load schemas
    const schemaFile = '/config/mqtt-schemas.json';
    const schemas = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
    
    // Compile all schemas
    const validators = {};
    for (const [topic, schema] of Object.entries(schemas.schemas)) {
        try {
            validators[topic] = ajv.compile(schema);
        } catch (err) {
            node.error(`Failed to compile schema for ${topic}: ${err.message}`);
        }
    }
    
    flow.set('mqtt_validator', { validators, definitions: schemas.definitions });
    node.warn(`[Schema Validator] Loaded ${Object.keys(validators).length} schemas`);
}

// Topic matching helper (supports wildcards)
function matchTopic(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');
    
    if (patternParts.length !== topicParts.length) return false;
    
    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i] === '+') continue;
        if (patternParts[i] === '#') return true;
        if (patternParts[i] !== topicParts[i]) return false;
    }
    return true;
}

// Main validation logic
const topic = msg.topic;
const payload = msg.payload;

// Skip validation for system topics
if (topic.startsWith('$SYS/')) {
    return msg;
}

// Find matching schema
const { validators } = flow.get('mqtt_validator');
let validator = null;
let matchedPattern = null;

for (const pattern of Object.keys(validators)) {
    if (matchTopic(pattern, topic)) {
        validator = validators[pattern];
        matchedPattern = pattern;
        break;
    }
}

// If no schema defined, pass through (optional: make this strict)
if (!validator) {
    node.warn(`[Schema Validator] No schema for topic: ${topic}`);
    return msg;
}

// Parse payload if string
let data = payload;
if (typeof payload === 'string') {
    try {
        data = JSON.parse(payload);
    } catch (e) {
        // Try as raw number/boolean
        if (payload === 'true') data = true;
        else if (payload === 'false') data = false;
        else if (!isNaN(payload)) data = parseFloat(payload);
        else data = payload; // Keep as string
    }
}

// Validate
const valid = validator(data);

if (valid) {
    // Attach validated & normalized payload
    msg.payload = data;
    msg._validated = true;
    msg._schema = matchedPattern;
    return msg;
} else {
    const errors = validator.errors.map(e => 
        `${e.instancePath} ${e.message}`
    ).join(', ');
    
    node.error(`[Schema Validation Failed] ${topic}: ${errors}`, msg);
    
    // Send to error output (configure node with 2 outputs)
    return [null, { 
        ...msg, 
        _validationError: errors,
        _schema: matchedPattern 
    }];
}
