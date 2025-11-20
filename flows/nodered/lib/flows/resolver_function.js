// Load config from global context
const cfg = global.get('modesCfg');

node.warn(`[resolver] Triggered! cfg=${!!cfg}, modes=${cfg ? Object.keys(cfg.modes||{}).join(',') : 'none'}`);

if (!cfg || !cfg.modes) {
    node.error('[resolver] Configuration not loaded');
    return null;
}

const now = new Date();
const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const currentDow = dayNames[now.getDay()];
const currentHour = now.getHours();
const currentMinute = now.getMinutes();
const currentTime = currentHour * 60 + currentMinute;

// Get calendar events tags
const calendarEvents = global.get('calendarEvents') || [];
const activeCalendarTags = new Set();
calendarEvents.forEach(event => {
    if (event.active && event.type === 'calendar') {
        // Extract tags from CATEGORIES or SUMMARY
        const summary = event.summary || '';
        const matches = summary.match(/\b(DOVOLENKA|HOME_OFFICE|DETI_DOMA)\b/gi);
        if (matches) {
            matches.forEach(tag => activeCalendarTags.add(tag.toUpperCase()));
        }
    }
});

// Get holiday status from holidays tab
const isHoliday = global.get('todayIsHoliday') || false;

// Evaluate each mode
const activeModesPerRoom = {};

Object.keys(cfg.modes).forEach(modeName => {
    const mode = cfg.modes[modeName];
    const activation = mode.activation;
    let isActive = true;
    
    if (modeName === 'hosty') {
        node.warn(`[resolver] Processing hosty mode: activation=${JSON.stringify(activation)}`);
    }
    
    // Check dow
    if (activation.dow && activation.dow.length > 0) {
        if (!activation.dow.includes(currentDow)) {
            isActive = false;
        }
    }
    
    // Check tod (time of day)
    if (isActive && activation.tod && activation.tod.length > 0) {
        let inTodRange = false;
        activation.tod.forEach(range => {
            const [start, end] = range.split('-');
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);
            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;
            
            if (currentTime >= startTime && currentTime <= endTime) {
                inTodRange = true;
            }
        });
        if (!inTodRange) {
            isActive = false;
        }
    }
    
    // Check date_range
    if (isActive && activation.date_range) {
        const fromStr = activation.date_range.from; // MM-DD
        const toStr = activation.date_range.to;
        const [fromMonth, fromDay] = fromStr.split('-').map(Number);
        const [toMonth, toDay] = toStr.split('-').map(Number);
        
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();
        
        // Simple range check (doesn't handle year wraparound)
        const current = currentMonth * 100 + currentDay;
        const from = fromMonth * 100 + fromDay;
        const to = toMonth * 100 + toDay;
        
        if (from <= to) {
            if (!(current >= from && current <= to)) {
                isActive = false;
            }
        } else {
            // Year wraparound (e.g., 12-24 to 01-06)
            if (!(current >= from || current <= to)) {
                isActive = false;
            }
        }
    }
    
    // Check holiday
    if (isActive && activation.holiday !== undefined) {
        if (activation.holiday !== isHoliday) {
            isActive = false;
        }
    }
    
    // Check calendar_tag
    if (isActive && activation.calendar_tag) {
        if (!activeCalendarTags.has(activation.calendar_tag)) {
            isActive = false;
        }
    }
    
    // Check calendar_mode (for SMH MODE=xxx events)
    if (isActive && activation.calendar_mode) {
        const calendarModeEvents = calendarEvents.filter(e => 
            e.active && e.type === 'mode' && e.params.mode === activation.calendar_mode
        );
        node.warn(`[resolver] Mode ${modeName}: checking calendar_mode=${activation.calendar_mode}, found ${calendarModeEvents.length} active events`);
        if (calendarModeEvents.length === 0) {
            isActive = false;
        }
    }
    
    // If mode is active, add to rooms with priority
    if (isActive) {
        Object.keys(mode.room_regime).forEach(roomOrGroup => {
            const regime = mode.room_regime[roomOrGroup];
            
            // Check if roomOrGroup is a group or single room
            let targetRooms = [];
            if (cfg.groups && cfg.groups[roomOrGroup]) {
                // It's a group, expand to individual rooms
                targetRooms = cfg.groups[roomOrGroup];
            } else if (roomOrGroup === '*') {
                // Wildcard for all rooms
                targetRooms = cfg.rooms;
            } else {
                // Single room
                targetRooms = [roomOrGroup];
            }
            
            targetRooms.forEach(room => {
                if (!activeModesPerRoom[room]) {
                    activeModesPerRoom[room] = [];
                }
                
                activeModesPerRoom[room].push({
                    mode: modeName,
                    regime: regime,
                    priority: mode.priority
                });
            });
        });
    }
});

// Select highest priority regime for each room
const resolvedRegimes = {};
cfg.rooms.forEach(room => {
    const activeModes = activeModesPerRoom[room] || [];
    
    if (activeModes.length === 0) {
        // No mode active, use base regime
        resolvedRegimes[room] = cfg.base_regime_by_room[room] || 'PT';
    } else {
        // Sort by priority (highest first)
        activeModes.sort((a, b) => b.priority - a.priority);
        resolvedRegimes[room] = activeModes[0].regime;
        
        node.warn(`[resolver] ${room}: ${activeModes[0].mode} (priority ${activeModes[0].priority}) → ${activeModes[0].regime}`);
    }
});

node.warn(`[resolver] Resolved regimes: ${JSON.stringify(resolvedRegimes)}`);

// Store in global context
global.set('activeRegimesByRoom', resolvedRegimes);

// Determine current active mode based on priority
const activeModes = Object.keys(cfg.modes).filter(modeName => {
    const mode = cfg.modes[modeName];
    let isActive = true;
    
    // Check basic activation rules
    if (mode.activation.dow && mode.activation.dow.length > 0) {
        if (!mode.activation.dow.includes(currentDow)) {
            isActive = false;
        }
    }
    
    // Check calendar_mode (for SMH MODE=xxx events)
    if (isActive && mode.activation.calendar_mode) {
        const calendarModeEvents = calendarEvents.filter(e => 
            e.active && e.type === 'mode' && e.params.mode === mode.activation.calendar_mode
        );
        if (calendarModeEvents.length === 0) {
            isActive = false;
        }
    }
    
    return isActive;
});

// Sort by priority
activeModes.sort((a, b) => (cfg.modes[b].priority || 0) - (cfg.modes[a].priority || 0));
const currentMode = activeModes[0] || 'pracovny_den'; // Default if no mode is active

// Return two messages:
// 1. Internal regimes state
// 2. Mode status for UI
return [
    {
        topic: 'virt/system/active_regimes',
        payload: {
            status: 'success',
            regimes: resolvedRegimes,
            timestamp: now.toISOString()
        },
        retain: true
    },
    {
        topic: 'smarthome/mode/current',
        payload: {
            mode: currentMode,
            active_modes: activeModes,
            regimes: resolvedRegimes,
            timestamp: now.toISOString()
        },
        retain: true
    }
];