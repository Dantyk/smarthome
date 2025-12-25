# SmartHome Testing

## Test Structure

```
tests/
├── unit/               # Unit tests (Jest)
│   ├── lib/           # Library functions
│   ├── hooks/         # React hooks
│   └── utils/         # Utility functions
├── integration/        # Integration tests
│   ├── mqtt/          # MQTT message flow tests
│   ├── api/           # API endpoint tests
│   └── nodered/       # Node-RED flow tests
└── e2e/               # End-to-end tests (Playwright)
    ├── ui/            # UI interaction tests
    └── scenarios/     # Full user scenarios
```

## Running Tests

### Unit Tests
```bash
cd ui/smarthome-ui
npm run test
npm run test:watch
npm run test:coverage
```

### Integration Tests
```bash
cd tests/integration
npm run test
```

### E2E Tests
```bash
cd tests/e2e
npm run test:e2e
npm run test:e2e:ui  # With browser UI
```

## Test Coverage Goals

- **Unit Tests**: >80% coverage for utils, hooks, commands
- **Integration Tests**: All MQTT topics, API endpoints
- **E2E Tests**: Critical user paths (set temp, boost mode, mode switching)

## Mock Services

Integration tests use Docker Compose test profile:
```bash
docker compose --profile test up -d
```

Services:
- Mock MQTT broker (Mosquitto)
- Mock Node-RED (stub flows)
- Test database
