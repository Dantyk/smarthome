# Planner Flow Refaktoring – odstránenie hardcodu EN názvov

## Problém
Planner tab má 4 hardcodované subflow inštancie:
- `planner_living` → publikuje `virt/room/living/...`
- `planner_bedroom` → publikuje `virt/room/bedroom/...`
- `planner_kitchen` → publikuje `virt/room/kitchen/...`
- `planner_kidroom1` → publikuje `virt/room/kidroom1/...`

Aj po zmazaní retained topicov sa EN topicy obnovujú, lebo flow ich aktívne publikuje.

## Riešenie
Namiesto statických 4 subflow inštancií:
1. "Prepare Room Schedules" iteruje cez `global.get('modesCfg').rooms` (načítané z modes.yaml)
2. Pre každú miestnosť publikuje MQTT správu s dynamickým room ID

## Implementácia v Node-RED
V tab_planner:
- **Odstrániť**: `planner_living`, `planner_bedroom`, `planner_kitchen`, `planner_kidroom1` (subflow inštancie)
- **Odstrániť**: `planner_mqtt_living`, `planner_mqtt_bedroom`, `planner_mqtt_kitchen`, `planner_mqtt_kidroom1` (MQTT out uzly)
- **Upraviť**: `planner_prepare_schedules` – namiesto `modes.profiles` iterovať cez `modesCfg.rooms`
- **Ponechať**: planner_subflow (template na weather correlation), ale použiť ho inak alebo nahradiť

### Nový flow
```
[Orchestrator Trigger] → [Orchestrate All Rooms]
                              ↓
                      [foreach room in cfg.rooms]
                              ↓
                      [Apply Weather Correlation to Edges]
                              ↓
                      [Publish Target Temps] → mqtt out (virt/room/{room}/target_temp)
```

Jednoduchšie: zrušiť subflow architektúru, spraviť jeden Function node, ktorý:
1. Načíta `modesCfg.rooms`
2. Pre každú miestnosť vypočíta edges (režim z resolver)
3. Aplikuje weather koreláciu
4. Publikuje `virt/room/{room}/target_temp` a `cmd/hvac/{room}/setpoint`

## Ďalšie kroky
Po refaktore spustiť `cleanup_english_topics.sh` a reštartovať Node-RED.
