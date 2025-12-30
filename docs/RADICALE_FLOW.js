// POST /api/calendar/create Node-RED flow
// Add to flows/nodered/flows.json

// 1. HTTP IN node
{
  "id": "api_calendar_create_in",
  "type": "http in",
  "z": "tab_api",
  "name": "POST /api/calendar/create",
  "url": "/api/calendar/create",
  "method": "post",
  "upload": false,
  "swaggerDoc": "",
  "x": 150,
  "y": 500,
  "wires": [["api_calendar_create_handler"]]
}

// 2. Function: Generate ICS
{
  "id": "api_calendar_create_handler",
  "type": "function",
  "z": "tab_api",
  "name": "Generate ICS",
  "func": "const { summary, start, end, description } = msg.payload;\n\nif (!summary || !start || !end) {\n    msg.statusCode = 400;\n    msg.payload = { error: 'Missing required fields: summary, start, end' };\n    return [msg, null];\n}\n\nconst uid = `smh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;\nconst now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';\nconst formatDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';\n\nconst ics = `BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nPRODID:-//SmartHome//Manual Event//EN\\r\\nBEGIN:VEVENT\\r\\nUID:${uid}\\r\\nDTSTAMP:${now}\\r\\nDTSTART:${formatDate(start)}\\r\\nDTEND:${formatDate(end)}\\r\\nSUMMARY:${summary}\\r\\n${description ? `DESCRIPTION:${description}\\r\\n` : ''}END:VEVENT\\r\\nEND:VCALENDAR`;\n\nconst radicaleUrl = env.get('RADICALE_URL') || 'http://radicale:5232';\nconst calId = env.get('RADICALE_CAL_ID') || 'smarthome';\n\nmsg.url = `${radicaleUrl}/${calId}/smarthome.ics/${uid}.ics`;\nmsg.method = 'PUT';\nmsg.headers = { 'Content-Type': 'text/calendar; charset=utf-8' };\nmsg.payload = ics;\nmsg._originalPayload = { summary, start, end, description, uid };\n\nreturn msg;",
  "outputs": 1,
  "x": 400,
  "y": 500,
  "wires": [["api_calendar_caldav_put"]]
}

// 3. HTTP Request: PUT to Radicale
{
  "id": "api_calendar_caldav_put",
  "type": "http request",
  "z": "tab_api",
  "name": "CalDAV PUT",
  "method": "use",
  "ret": "txt",
  "url": "",
  "tls": "",
  "persist": false,
  "proxy": "",
  "authType": "",
  "senderr": false,
  "x": 640,
  "y": 500,
  "wires": [["api_calendar_create_response"]]
}

// 4. Response Handler
{
  "id": "api_calendar_create_response",
  "type": "function",
  "z": "tab_api",
  "name": "Format Response",
  "func": "const orig = msg._originalPayload;\nconst statusCode = msg.statusCode;\n\nif (statusCode === 201 || statusCode === 204) {\n    msg.statusCode = 201;\n    msg.payload = {\n        status: 'ok',\n        message: 'Event created',\n        event: orig,\n        timestamp: new Date().toISOString()\n    };\n    node.warn(`[api] Created calendar event: ${orig.summary}`);\n} else {\n    msg.statusCode = 500;\n    msg.payload = {\n        error: 'Failed to create event',\n        details: msg.payload\n    };\n}\n\nreturn msg;",
  "outputs": 1,
  "x": 850,
  "y": 500,
  "wires": [["api_response"]]
}
