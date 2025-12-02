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

5) Vsetky hesla a citlive udaje sa maju nacitavat z environment premenych, nikdy nie bytovo v kode alebo konfiguracnych suboroch.

6) **Node-RED flows editing** (`flows/nodered/flows.json`):
   - Súbor je **JSON** obsahujúci všetky Node-RED flow konfigurácie
   - **KRITICKÉ**: Pri úprave zachovaj presný JSON formát, vrátane čiarok, zátvoriek a úvodzoviek
   - Každý node má `id`, `type`, `z` (tab id), `name`, `func` (pre function nodes), `wires` (prepojenia)
   - Function nodes obsahujú JavaScript kód v poli `func` ako string s escapovanými `\n`
   
   **Workflow pre úpravy:**
   ```bash
   # 1. Edituj flows.json súbor (použij replace_string_in_file alebo multi_replace)
   # 2. Reštartuj Node-RED kontajner
   cd /home/pi/smarthome/compose
   docker compose restart nodered
   
   # 3. Počkaj 20-30s na načítanie flows
   sleep 25
   
   # 4. Over logy či nie sú syntax errors
   docker compose logs --tail=50 nodered | grep -i error
   ```
   
   **Časté úpravy:**
   - **Function node kód**: Nájdi node podľa `"name"`, uprav pole `"func"` (JavaScript ako string)
   - **MQTT topic**: Nájdi mqtt node, uprav `"topic"` pole
   - **Cron výraz**: Nájdi cronplus node, uprav `"expression"` v options array
   - **HTTP URL**: Nájdi http request node, uprav `"url"` pole
   
   **Príklad function node úpravy:**
   ```json
   {
     "id": "node123",
     "type": "function",
     "name": "Parse Alert",
     "func": "const alert = msg.payload;\nif (!alert.severity) return null;\nreturn msg;",
     "outputs": 1
   }
   ```
   
   **Nezabudni:**
   - Použiť `\n` pre nové riadky v `func` stringoch
   - Escapovať úvodzovky: `\"text\"`
   - Zachovať JSON syntax (čiarky medzi poľami, nie za posledným)
   - Reštartovať nodered po každej zmene