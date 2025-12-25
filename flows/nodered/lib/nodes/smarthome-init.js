module.exports = function(RED) {
    'use strict';
    
    function SmartHomeInitNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.status({fill:"yellow",shape:"ring",text:"initializing..."});
        
        try {
            // Load init.js module
            const initPath = require('path').join(__dirname, '..', 'init.js');
            const initModule = require(initPath);
            
            // Call init function with RED instance
            if (typeof initModule === 'function') {
                initModule(RED);
                node.status({fill:"green",shape:"dot",text:"initialized"});
                node.log('SmartHome libraries initialized successfully');
                
                // Send success message
                node.send({ payload: { status: 'success', timestamp: new Date().toISOString() } });
            } else {
                throw new Error('init.js did not export a function');
            }
        } catch (err) {
            node.status({fill:"red",shape:"dot",text:"error"});
            node.error('Failed to initialize SmartHome libraries: ' + err.message);
            node.send({ payload: { status: 'error', error: err.message, timestamp: new Date().toISOString() } });
        }
    }
    
    RED.nodes.registerType("smarthome-init", SmartHomeInitNode);
}
