---
project: "Moonbase Alpha — Habitat Module"
created: 2026-02-01T00:00:00.000Z
views:
  default:
    group_by: status
    sort_by: priority
    sort_order: desc
columns:
  - field: id
    width: 60
  - field: title
    width: 300
  - field: status
    width: 110
  - field: priority
    width: 100
  - field: assignee
    width: 110
  - field: due
    width: 110
  - field: tags
    width: 180
  - field: link
    width: 200
    type: url
  - field: module
    width: 110
    type: select
  - field: created
    width: 110
  - field: done
    width: 110
status_options:
  - todo
  - in_progress
  - in_review
  - done
  - blocked
priority_options:
  - urgent
  - high
  - medium
  - low
assignee_options:
  - Yuki Tanaka
  - Marco Rossi
  - Priya Sharma
  - Leo Fischer
module_options:
  - Life Support
  - Power Grid
  - Comms
  - Hydroponics
  - EVA Ops
---

# Moonbase Alpha — Habitat Module

## Tasks

| Id | Title | Status | Priority | Assignee | Due | Tags | Link | Module | Created | Done |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Seal airlock pressure leak in corridor B | done | urgent | Yuki Tanaka | 2026-02-10 | safety, hull | https://nasa.gov/airlock-specs | Life Support | 2026-02-01 | 2026-02-09 |
| 002 | Calibrate oxygen recycler sensors | done | high | Priya Sharma | 2026-02-12 | sensors, maintenance | https://example.com/o2-recycler-manual | Life Support | 2026-02-01 | 2026-02-11 |
| 003 | Replace solar panel array 3-C | in_progress | high | Leo Fischer | 2026-02-20 | solar, hardware | https://example.com/panel-3c-datasheet | Power Grid | 2026-02-03 | |
| 004 | Update antenna firmware to v4.7 | in_review | medium | Marco Rossi | 2026-02-18 | firmware, comms | https://example.com/antenna-fw-changelog | Comms | 2026-02-04 | |
| 005 | Plant hydroponic lettuce batch 12 | done | medium | Priya Sharma | 2026-02-14 | crops, food | | Hydroponics | 2026-02-02 | 2026-02-13 |
| 006 | Fix temperature regulator in lab module | in_progress | urgent | Yuki Tanaka | 2026-02-22 | thermal, repair | https://example.com/thermal-reg-schematic | Life Support | 2026-02-05 | |
| 007 | EVA suit helmet visor inspection | todo | high | Leo Fischer | 2026-02-25 | eva, safety, inspection | https://example.com/eva-suit-checklist | EVA Ops | 2026-02-06 | |
| 008 | Backup navigation database | done | high | Marco Rossi | 2026-02-15 | data, backup | | Comms | 2026-02-03 | 2026-02-14 |
| 009 | Install water filtration module 2 | blocked | high | Priya Sharma | 2026-02-28 | water, installation | https://example.com/filtration-mod2-specs | Life Support | 2026-02-07 | |
| 010 | Test emergency power failover | todo | urgent | Leo Fischer | 2026-03-01 | power, testing, safety | https://example.com/failover-test-protocol | Power Grid | 2026-02-08 | |
| 011 | Harvest tomato crop cycle 9 | in_progress | low | Priya Sharma | 2026-02-24 | crops, food | | Hydroponics | 2026-02-10 | |
| 012 | Upgrade comm relay to 5 GHz band | todo | medium | Marco Rossi | 2026-03-05 | comms, upgrade | https://example.com/5ghz-relay-proposal | Comms | 2026-02-11 | |
| 013 | Patch rover telemetry software | in_review | medium | Yuki Tanaka | 2026-02-26 | software, rover | https://example.com/rover-telemetry-patch | EVA Ops | 2026-02-09 | |
| 014 | Restock EVA oxygen tanks | todo | high | Leo Fischer | 2026-03-02 | eva, supplies | | EVA Ops | 2026-02-12 | |
| 015 | Run soil nutrient analysis | todo | low | Priya Sharma | 2026-03-08 | science, hydroponics | https://example.com/soil-analysis-protocol | Hydroponics | 2026-02-14 | |
| 016 | Recalibrate solar tracker motors | blocked | medium | Leo Fischer | 2026-03-04 | solar, calibration | | Power Grid | 2026-02-13 | |
| 017 | Deploy mesh network repeater node 7 | todo | medium | Marco Rossi | 2026-03-10 | networking, hardware | https://example.com/mesh-node7-location | Comms | 2026-02-15 | |
| 018 | Inspect hull micro-fractures sector 4 | in_progress | urgent | Yuki Tanaka | 2026-02-23 | hull, safety, inspection | https://example.com/sector4-scan-results | Life Support | 2026-02-06 | |

## Task Details

### tid-001
<p>Pressure drop detected in corridor B airlock seal. Immediate action required:</p>
<ul>
<li>Isolate corridor B from main habitat ring</li>
<li>Apply temporary sealant compound to inner gasket</li>
<li>Order replacement gasket from Earth supply drop (ETA: 45 days)</li>
<li>Monitor pressure readings every 4 hours until permanent fix</li>
</ul>

### tid-006
<p>Lab module temperature spiking to 31 °C during peak solar exposure. The thermal regulator board shows intermittent faults on channel 3:</p>
<ul>
<li>Swap channel 3 relay with spare from storage bay E-12</li>
<li>Recalibrate thermal setpoints for lab zones A through D</li>
<li>Run 48-hour burn-in test before clearing for full duty</li>
</ul>

### tid-009
<p>Blocked — waiting on supply shuttle Artemis-7 to deliver the filtration cartridges. Expected arrival 2026-02-26.</p>
<ul>
<li>Pre-route plumbing connections in utility corridor</li>
<li>Prepare mounting brackets (can do before cartridges arrive)</li>
<li>Schedule 6-hour water system downtime with crew</li>
</ul>

### tid-018
<p>Routine hull scan detected three micro-fractures in sector 4 outer shell. None are critical yet but need monitoring and patching:</p>
<ul>
<li>Fracture 4-A: 2.1 mm — apply epoxy patch, monitor weekly</li>
<li>Fracture 4-B: 0.8 mm — mark and monitor, no action yet</li>
<li>Fracture 4-C: 3.4 mm — apply epoxy patch + external sealant during next EVA</li>
</ul>

## Notes
<p>This is the task board for <strong>Moonbase Alpha — Habitat Module</strong>. It demonstrates all supported NoteHub field types:</p>
<ul>
<li><strong>Text</strong> — id, title (plain text fields)</li>
<li><strong>Select</strong> — status, priority, assignee, module (dropdown with configurable options)</li>
<li><strong>Date</strong> — due, created, done (date picker)</li>
<li><strong>Tags</strong> — tags (comma-separated colored pills)</li>
<li><strong>URL</strong> — link (clickable links that open in browser)</li>
</ul>
<p>Edit any cell to try it out. Changes are saved back to the markdown file automatically.</p>
