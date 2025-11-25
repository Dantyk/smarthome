#!/usr/bin/env python3
"""
Update Node-RED watcher flow to use exec node with stat command
"""
import json

flows_path = '/home/pi/smarthome/flows/nodered/flows.json'

# Read flows
with open(flows_path, 'r') as f:
    flows = json.load(f)

# Remove old watcher nodes
flows = [node for node in flows if node.get('z') != 'tab_watcher' and node.get('id') != 'tab_watcher']

# New watcher nodes with exec approach
WATCHER_NODES = [
    {
        "id": "tab_watcher",
        "type": "tab",
        "label": "Config Watcher",
        "disabled": False,
        "info": "Sleduje zmeny v modes.yaml pomocou stat command"
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
        "wires": [["watcher_exec"]]
    },
    {
        "id": "watcher_exec",
        "type": "exec",
        "z": "tab_watcher",
        "command": "stat -c %Y /config/modes.yaml",
        "addpay": "",
        "append": "",
        "useSpawn": "false",
        "timer": "",
        "winHide": False,
        "oldrc": False,
        "name": "Get mtime",
        "x": 330,
        "y": 100,
        "wires": [["watcher_check"], [], []]
    },
    {
        "id": "watcher_check",
        "type": "function",
        "z": "tab_watcher",
        "name": "Compare mtime",
        "func": """const currentMtime = parseInt(msg.payload.toString().trim());
let lastMtime = context.get('lastMtime') || null;

if (lastMtime === null) {
    context.set('lastMtime', currentMtime);
    node.status({fill: 'green', shape: 'dot', text: 'watching'});
    return null;
}

if (currentMtime > lastMtime) {
    context.set('lastMtime', currentMtime);
    node.status({fill: 'yellow', shape: 'ring', text: 'reload triggered'});
    node.warn('[watcher] modes.yaml changed, triggering reload');
    return msg;
}

node.status({fill: 'green', shape: 'dot', text: 'watching'});
return null;""",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 530,
        "y": 100,
        "wires": [["loader_inject"]]
    }
]

# Add new watcher nodes
flows.extend(WATCHER_NODES)

# Write back
with open(flows_path, 'w') as f:
    json.dump(flows, f)

print(f"Updated watcher flow with exec node approach")
