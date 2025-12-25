# SmartHome Architecture Documentation

## Table of Contents

- [System Context (C4 Level 1)](./c4-context.md)
- [Container Diagram (C4 Level 2)](./c4-container.md)
- [Component Diagram (C4 Level 3)](./c4-component.md)
- [MQTT Topics Reference](./mqtt-topics.md)
- [Data Flow Diagrams](./data-flow.md)

## Overview

SmartHome je distribuovaný systém pre riadenie domáceho vykurovania s nasledujúcimi vlastnosťami:

- **Event-Driven Architecture**: MQTT message broker ako centrálna komunikačná páteř
- **Microservices Ready**: Modulárna architektúra pripravená na extrakciu služieb
- **Configuration as Code**: YAML konfigurácie s JSON schema validáciou
- **Real-time UI**: Next.js aplikácia s WebSocket MQTT pripojením

## Architecture Decision Records (ADR)

Všetky architektonické rozhodnutia sú dokumentované v [ADR](../adr/).

## Key Components

### Core Services (Always Running)
- **Mosquitto MQTT Broker**: Message transport layer
- **Node-RED**: Business logic orchestration
- **Baïkal CalDAV**: Local calendar storage
- **Next.js UI**: Web interface (port 8088)

### Optional Services (Docker Compose Profiles)
- **Z-Wave JS UI** (profile: `zwave`)
- **Zigbee2MQTT** (profile: `zigbee`)
- **InfluxDB + Grafana** (profile: `metrics`)
- **Apprise** (profile: `notify`)

## Quality Attributes

### Reliability
- Docker healthchecks pre všetky služby
- MQTT message persistence (retained)
- Automatic service restart policies

### Security
- Lokálne nasadenie (no cloud dependencies)
- Environment-based secrets management
- Future: MQTT TLS encryption

### Maintainability
- JSON Schema validation pre MQTT messages
- Centralized API Gateway pattern
- Comprehensive test coverage (unit, integration, e2e)

### Scalability
- Stateless UI (horizontally scalable)
- MQTT QoS levels pre message delivery
- Future: Microservices extraction from Node-RED

## Technology Stack

| Layer | Technology |
|-------|-----------|
| UI | Next.js 14, React 18, TypeScript, Zustand |
| Business Logic | Node-RED, JavaScript |
| Message Broker | Eclipse Mosquitto (MQTT) |
| Calendar | Baïkal (CalDAV), Google Calendar API |
| Metrics | InfluxDB 2, Grafana |
| Container Runtime | Docker Compose |
| Testing | Jest, Playwright |
| CI/CD | GitHub Actions |

## Deployment Model

```
┌─────────────────────────────────────────┐
│         Raspberry Pi (Host OS)          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │      Docker Compose Stack         │  │
│  │                                   │  │
│  │  ┌─────┐  ┌────────┐  ┌───────┐  │  │
│  │  │MQTT │  │Node-RED│  │Baïkal │  │  │
│  │  └──┬──┘  └───┬────┘  └───────┘  │  │
│  │     │         │                   │  │
│  │  ┌──▼─────────▼──┐                │  │
│  │  │   Next.js UI  │                │  │
│  │  └───────────────┘                │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Physical Devices (USB/GPIO)     │  │
│  │  - Z-Wave Stick                   │  │
│  │  - Zigbee Coordinator             │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## References

- [MQTT Topics Reference](./mqtt-topics.md)
- [Troubleshooting Guide](../runbooks/troubleshooting.md)
- [Deployment Checklist](../runbooks/deployment.md)
