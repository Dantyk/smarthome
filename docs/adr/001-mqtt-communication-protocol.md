# ADR-001: MQTT as Primary Communication Protocol

**Status**: Accepted  
**Date**: 2025-12-25  
**Deciders**: Architecture Team  

## Context

SmartHome systém potrebuje komunikačný protokol pre:
- Real-time komunikáciu medzi komponentmi
- Decoupling medzi UI, business logikou a zariadeniami
- Support pre IoT zariadenia (Z-Wave, Zigbee)
- Low latency pre termostatické kontroly
- Offline message persistence

## Decision

Použijeme **Eclipse Mosquitto MQTT broker** ako centrálnu komunikačnú páteř.

## Rationale

### Prečo MQTT?

1. **Pub/Sub Pattern**: Natural fit pre event-driven architecture
2. **Lightweight**: Nízka overhead, vhodné pre embedded zariadenia
3. **QoS Levels**: Garantovaná message delivery (QoS 1, 2)
4. **Retained Messages**: Automatická synchronizácia stavu pre nové klientov
5. **Wildcards**: Flexibilná topic subscription (`+`, `#`)
6. **WebSocket Support**: Priame pripojenie z Next.js UI
7. **Wide Adoption**: Štandardný protokol pre IoT (Z-Wave JS, Zigbee2MQTT)

### Alternatívy

| Protokol | Pros | Cons | Verdict |
|----------|------|------|---------|
| **HTTP REST** | Simple, well-known | Polling required, no push | ❌ Too chatty for real-time |
| **WebSocket** | Bi-directional, low latency | Custom protocol needed | ❌ Reinventing wheel |
| **RabbitMQ/AMQP** | Enterprise features | Overkill, heavy | ❌ Too complex |
| **Redis Pub/Sub** | Fast, simple | No message persistence | ❌ Loses messages on restart |
| **MQTT** | Purpose-built for IoT | Requires broker | ✅ **Selected** |

## Consequences

### Positive

- ✅ Decoupling medzi všetkými komponentmi
- ✅ Real-time UI updates bez polling
- ✅ Retained messages = automatic state sync
- ✅ Kompatibilita s existujúcimi IoT zariadeniami
- ✅ Topic hierarchy = logické groupovanie

### Negative

- ❌ SPOF: Ak Mosquitto spadne, celý systém prestane komunikovať
  - *Mitigation*: Docker healthchecks + restart policy
- ❌ No built-in authentication v základnej konfigurácii
  - *Mitigation*: Lokálne nasadenie (trusted network)
- ❌ Debugging MQTT flows je náročnejší než HTTP
  - *Mitigation*: MQTT Explorer tool, structured logging

### Neutral

- 🔶 Potrebná JSON schema validácia (nie native MQTT feature)
  - *Solution*: Custom validator v Node-RED
- 🔶 Topic naming conventions musia byť dokumentované
  - *Solution*: Centrálna docs/mqtt-topics.md

## Implementation Details

### Topic Hierarchy
```
/virt/    - Virtual topics (internal state)
/stat/    - Status from devices
/cmd/     - Commands to devices
/event/   - Events (alerts, triggers)
/meta/    - Metadata (health, version)
```

### QoS Strategy
- QoS 0: Logs, non-critical events
- QoS 1: Commands, status updates (default)
- QoS 2: Safety-critical alerts (smoke, security)

### Retained Messages
- State topics: Always retained (`virt/room/+/target_temp`)
- Commands: Never retained (`cmd/room/+/set_target`)
- Events: Never retained (`event/safety/smoke/+`)

## Related Decisions

- [ADR-002: Node-RED as Orchestration Engine](./002-nodered-orchestration.md)
- [ADR-003: JSON Schema Validation for MQTT](./003-mqtt-schema-validation.md)

## References

- [MQTT Specification v5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
- [Mosquitto Documentation](https://mosquitto.org/documentation/)
- [MQTT Topics Best Practices](https://www.hivemq.com/blog/mqtt-essentials-part-5-mqtt-topics-best-practices/)
