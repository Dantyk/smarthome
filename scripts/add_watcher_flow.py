#!/usr/bin/env python3
"""
Add config watcher flow to Node-RED flows.json
"""
import json
import sys

# New watcher nodes
WATCHER_NODES = [
    {
        "id": "tab_watcher",
        "type": "tab",
        "label": "Config Watcher",
        "disabled": False,
        "info": "Sleduje zmeny v modes.yaml a triggeruje reload"
    },
    {
        "id": "watcher_inject",
        "type": "inject",
        "z": "tab_watcher",
        "name": "Check every 30s",
        "props": [{"p": "payload"}],
        "repeat": "30",
        "crontab": "",
        "once": True,
        "onceDelay": "10",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "x": 140,
        "y": 100,
        "wires": [["watcher_check"]]
    },
    {
        "id": "watcher_check",
        "type": "function",
        "z": "tab_watcher",
        "name": "Check mtime",
        "func": """// File watcher for modes.yaml
const fs = require('fs');
const path = '/config/modes.yaml';

// Store last modified time in context
let lastMtime = context.get('lastMtime') || null;

try {
    const stats = fs.statSync(path);
    const currentMtime = stats.mtime.getTime();
    
    if (lastMtime === null) {
        context.set('lastMtime', currentMtime);
        node.status({fill: 'green', shape: 'dot', text: 'watching'});
        return null;
    }
    
    if (currentMtime > lastMtime) {
        context.set('lastMtime', currentMtime);
        node.status({fill: 'yellow', shape: 'ring', text: 'change detected'});
        node.warn(`modes.yaml changed at ${new Date(currentMtime).toISOString()}`);
        return msg;
    }
    
    node.status({fill: 'green', shape: 'dot', text: 'watching'});
    return null;
} catch (err) {
    node.error(`Check failed: ${err.message}`);
    node.status({fill: 'red', shape: 'ring', text: 'error'});
    return null;
}""",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 340,
        "y": 100,
        "wires": [["loader_inject"]]
    }
]

def main():
    flows_path = '/home/pi/smarthome/flows/nodered/flows.json'
    
    # Read existing flows
    with open(flows_path, 'r') as f:
        flows = json.load(f)
    
    # Check if watcher already exists
    if any(node.get('id') == 'tab_watcher' for node in flows):
        print("Watcher already exists, skipping")
        return
    
    # Add watcher nodes
    flows.extend(WATCHER_NODES)
    
    # Write back
    with open(flows_path, 'w') as f:
        json.dump(flows, f)
    
    print(f"Added {len(WATCHER_NODES)} watcher nodes to flows.json")

if __name__ == '__main__':
    main()
