# Project-specific Copilot instructions

1) Always reply in Slovak when interacting about this repository. Short, clear, and technical Slovak is preferred.

2) UI build / deployment steps (must be followed after any code changes under `ui/smarthome-ui`):

```bash
# build the Next.js UI locally
cd ui/smarthome-ui
npm ci
npm run build

# then rebuild the docker image and restart the ui service
cd ../../compose
docker compose build ui
docker compose up -d ui
```

3) Quick checks after deploy:
- Verify server HTML does not contain stale disabled controls by curling the root page locally.
- Open browser DevTools and confirm MQTT websocket connects to `ws://<host>:9001/`.

4) When editing UI code, prefer creating small client-only components for interactive widgets to avoid SSR/CSR hydration mismatches.
