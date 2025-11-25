// File watcher for modes.yaml - triggers reload on config change
const fs = require('fs');
const path = '/config/modes.yaml';

// Store last modified time
let lastMtime = null;

// Check file modification time
try {
    const stats = fs.statSync(path);
    const currentMtime = stats.mtime.getTime();
    
    if (lastMtime === null) {
        // First run - just store the time
        lastMtime = currentMtime;
        node.status({fill: 'green', shape: 'dot', text: 'watching'});
        return null;
    }
    
    if (currentMtime > lastMtime) {
        // File was modified - trigger reload
        lastMtime = currentMtime;
        node.status({fill: 'yellow', shape: 'ring', text: 'change detected'});
        node.warn(`modes.yaml changed, triggering reload (mtime: ${new Date(currentMtime).toISOString()})`);
        return msg;
    }
    
    // No change
    return null;
    
} catch (err) {
    node.error(`Failed to check modes.yaml: ${err.message}`);
    node.status({fill: 'red', shape: 'ring', text: 'error'});
    return null;
}
