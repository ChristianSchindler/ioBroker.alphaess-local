# ioBroker.alphaess-local

Reads AlphaESS inverters and batteries **locally via Modbus TCP** – no cloud, no account, no developer key.
Includes a modern **power flow widget for VIS-2**.

Tested with: **SMILE-T10-HV + BAT-8.2P** (firmware ARM V0.08 / DSP V0.05).
Other AlphaESS household systems with Modbus (SMILE5, SMILE-G3, SMILE-Hi, STORION …) use the same register map and should work.

## Requirements

- Inverter connected to the LAN by Ethernet, Modbus TCP enabled (port 502, slave ID 85)
- ioBroker js-controller ≥ 5, admin ≥ 7, Node.js ≥ 20 (the adapter itself runs on Node 20; current admin/web/VIS-2 need Node 22)

> **Only one Modbus client at a time:** the inverter refuses a second Modbus TCP connection.
> Don't run this adapter in parallel with `ioBroker.modbus`, Home Assistant or another script against the same inverter.
> After another client disconnects, the inverter can need ~2 minutes before it accepts a new connection – the adapter retries automatically.
- For the widget: VIS-2

## Installation

The adapter is not in the official ioBroker repository – it is installed directly from GitHub:

1. ioBroker Admin → **Adapters** → **Install from custom URL** (GitHub/octocat icon in the toolbar; expert mode may need to be switched on)
2. Tab **Custom** → paste the link of a release, e.g.
   ```
   https://github.com/ChristianSchindler/ioBroker.alphaess-local/tree/v0.1.1
   ```
   (the current version is on the [releases page](https://github.com/ChristianSchindler/ioBroker.alphaess-local/releases))
3. **Install** → add an instance → enter the inverter IP in the instance settings

From the command line: `iobroker url https://github.com/ChristianSchindler/ioBroker.alphaess-local/tree/v0.1.1`

**Update:** same steps with the link of the new version – the instance and its settings are kept.

> ioBroker only accepts repository links from github.com (`…/tree/<tag>`), not download links of release files.
> Use a version tag (`/tree/vX.Y.Z`): only release commits contain the built VIS-2 widget.

## Configuration

| Setting | Default | |
|---|---|---|
| Inverter IP address | – | **required** – the adapter does not start polling without it |
| Fallback IP addresses | – | comma separated; used automatically if the main IP stops answering. The IP in use is shown in `info.host` |
| Port / Slave ID / Timeout | 502 / 85 / 3000 ms | |
| Poll interval live values | 0.2 s | minimum 0.2 s (= 5 polls per second), can also be changed at runtime via `info.pollInterval` |
| Poll interval settings | 60 s | settings and time windows |
| PV strings | 2 | 1 – 6 |
| Only update on change | on | |
| Enable control | **off** | makes `settings.*` writable |

### How often does the inverter deliver new values?

Measured on a SMILE-T10-HV (sampling every 0.3 s for 90 s, one Modbus read takes ~10 ms):

| Value | Changes every |
|---|---|
| Grid power (smart meter) | ≤ 0.3 s – faster than we could sample |
| Inverter AC power | ~1 s |
| Battery power | ~1 s |
| PV string power | ~3 s |
| Battery SOC | only on whole 0.1 % steps |

A poll interval of **1 s** gives you practically every change; 5 s is a good default for history/database load.
One complete poll (3 register blocks) takes about 30 ms.

## Data points

```
alphaess-local.0
├── overview          ← clean power flow values for dashboards / widgets
│   ├── pv_power, load_power, grid_power, battery_power, battery_soc
│   ├── grid_import, grid_export, battery_charge, battery_discharge   (always ≥ 0)
│   ├── autarky, self_consumption                                   (%, current)
│   └── alarm (0 = OK, 1 = warning, 2 = fault), alarm_text           (active codes, empty = none)
├── grid              smart meter: power (+import / −export), power_l1..l3, voltage_l1..l3,
│                     current_l1..l3, frequency, reactive_power, apparent_power
├── pv                power, string1..n.{voltage, current, power}
├── battery           soc, soh, power, voltage, current, capacity, modules, status, relay_status,
│   │                 max_charge/discharge_current, max_charge/discharge_power, charge/discharge_cutoff_voltage,
│   │                 warning, fault   (bit codes, 0 = none)
│   └── cells         min/max_voltage, voltage_spread (mV), min/max_temperature
├── inverter          power, power_l1..l3, voltage_l1..l3, current_l1..l3, frequency, temperature, work_mode,
│   │                 warning_1/2, fault_1/2   (bit codes, 0 = none)
│   └── backup        voltage_l1..l3, power  (EPS output)
├── energy
│   ├── today         pv, consumption, grid_feed_in, grid_consumption, battery_charge, battery_discharge,
│   │                 autarky, self_consumption, since   (see "How the daily values work")
│   └── total         pv, consumption, grid_feed_in, grid_consumption, battery_charge, battery_discharge,
│                     battery_charge_from_grid
├── settings          max_feed_in, pv_capacity, time_period_control
│   ├── charge        cutoff_soc, window1_start/end, window2_start/end   ("HH:MM")
│   └── discharge     cutoff_soc, window1_start/end, window2_start/end
├── device            inverter_sn, ems_sn, arm_version, dsp_version, bmu_version
└── info              connection, host, lastUpdate, pollDuration, pollInterval
```

Sign convention (same as AlphaESS): grid **+ import / − export**, battery **+ discharge / − charge**.
Every register state carries its Modbus address in `native.address`.

`overview.alarm_text` names the active warnings/faults, e.g. `Battery warning: Cell low voltage (0x80)`. The bit meanings
come from the AlphaESS *Modbus register parameter list* (Notes 4, 26, 28, 32, tables of the EMS3.5/EMS3.6 platform).
The raw code is kept in brackets and in the `battery.warning` / `battery.fault` / `inverter.warning_*` / `inverter.fault_*` states.

### How the daily values work

The inverter has no daily counters on Modbus, only lifetime counters (`energy.total.*`).
The adapter calculates **today = counter now − counter at the start of the day**:

- The counters are saved every minute (and on shutdown) in `energy.today.baseline`.
- At the day change, the last counters of the previous day become the start value - so the day is complete
  even if ioBroker was restarted or offline over midnight (energy between shutdown and midnight is then counted to the new day).
- On the **very first day** after installation (or after more than a day offline) there is no start value yet:
  the values count from the adapter start. `energy.today.since` shows from when the values are counted
  (midnight on a normal day).
- Resolution: PV and battery counters step in 0.1 kWh, grid counters in 0.01 kWh.

## Comparison with the cloud adapter `ioBroker.alpha-ess`

| | alpha-ess (cloud) | **alphaess-local** |
|---|---|---|
| Data source | AlphaESS Open API (internet) | Modbus TCP in the LAN |
| Account / developer key | required | – |
| Works without internet | ✗ | ✓ |
| Fastest update | API limited (≥ 10 s realtime, energy values in minutes) | 0.2 s (5×/s) |
| PV / load / grid / battery power, SOC | ✓ | ✓ |
| Grid power per phase | ✓ | ✓ |
| Inverter power per phase | ✓ | ✓ |
| Voltages, currents, frequency (grid + inverter) | ✗ | ✓ |
| Reactive / apparent power | ✗ | ✓ |
| PV string voltage / current / power | power only | ✓ |
| Battery voltage, current, SOH, BMS limits | ✗ | ✓ |
| Battery cell min/max voltage + temperature | ✗ | ✓ |
| Inverter temperature, work mode | ✗ | ✓ |
| Backup (EPS) output | ✗ | ✓ |
| Energy today | ✓ | ✓ (calculated from counters) |
| Lifetime counters (PV, grid, battery, grid→battery) | PV only | ✓ |
| Self-sufficiency / self-consumption | total only | now + today |
| Charge / discharge time windows + cut-off SOC | ✓ (writable) | ✓ (writable, opt-in) |
| Feed-in limit | ✗ | ✓ (writable, opt-in) |
| Serial numbers, firmware versions | system SN | inverter SN, EMS SN, ARM/DSP/BMU versions |
| Income, CO₂ saving, trees, currency | ✓ | ✗ (cloud calculations) |
| AlphaESS wallbox start/stop + current | ✓ | ✗ |
| Battery / inverter model names, nominal power | ✓ | capacity + PV capacity only |
| VIS-2 widget | ✗ | ✓ power flow widget |

Both adapters can run at the same time if you need the wallbox control of the cloud adapter.

## VIS-2 widget "Power flow"

Widget set **AlphaESS local** → **Power flow**. Select the adapter instance and all data points are filled in automatically.

**Navigation:** in the widget attributes, group *Navigation (click → view)*, choose a VIS view for each of the four nodes
(Solar, Grid, House, Battery, Wallbox). Clicking the node in the runtime opens that view; nodes without a view are not clickable.
Tick **open as popup** below a view to show it in a popup window over the current page instead (e.g. a chart view
for the battery); *Popup width/height* set its size. The popup closes with ×, Escape or a click next to it.

- Animated flow lines – speed follows the power, direction follows the energy flow
- Battery with state-of-charge ring (green / amber below 35 % / red below 15 %)
- Grid colour changes between import (rose) and feed-in (sky blue)
- Today chips: solar, consumption, feed-in, self-sufficiency
- Themes: dark, light, transparent; live/offline indicator

**Wallbox (optional, any manufacturer):** in the attribute group *Wallbox* select the charging power data point of your
wallbox – from any adapter (go-e, Easee, KEBA, openWB, …), a script or an alias. The wallbox node only appears
once this data point is set; without it the widget looks as before.

| Attribute | Meaning |
|---|---|
| Charging power | required for the node; unit W or kW selectable |
| Wallbox is part of house consumption | default on: the inverter measures the whole house incl. wallbox, so the wallbox power is subtracted from *House* |
| Status | optional; `true`/`false` → connected / not connected, text is shown as is |
| Car SOC | optional, shown next to the status |
| Energy today (kWh) | optional, adds a *Wallbox* chip to the today row |
| Wallbox opens view | navigation like the other nodes |

## Releasing a new version

Releases are built by GitHub Actions – nothing has to be built locally:

1. Push your changes to `main` (the **Test** workflow runs the unit tests and builds the widget on every push)
2. GitHub → **Actions** → **Release** → **Run workflow** → enter the new version (e.g. `0.2.0`) and what changed
3. The workflow sets the version in `package.json` / `io-package.json` (incl. the changelog shown in ioBroker),
   runs the tests, builds the widget, commits the version **together with the built widget** (`widgets/`), tags `vX.Y.Z`
   and creates the GitHub release (with `iobroker.alphaess-local-X.Y.Z.tgz` attached for manual installs)

Locally the same version bump can be done with `node scripts/set-version.mjs 0.2.0 "What changed"`.

## Development

```bash
npm install
npm test                       # unit tests (register decoding, calculations)
node test/live.js <inverter-ip>   # read all registers from a real inverter

cd src-widgets
npm install                    # needs Node.js ≥ 20.19 (vite 8)
npm run build                  # builds the widget into ../widgets/alphaess-local
# Preview without ioBroker, with live values from the inverter:
node preview/live-server.cjs <inverter-ip>
npx vite --config vite.preview.config.mjs    # → http://localhost:4174/preview.html
```


## License

MIT


### Taken from the [VIS-2 widget template](https://github.com/ioBroker/ioBroker.vis-2-widgets-react-template) (MIT, ~123 lines)

| File | Origin |
|---|---|
| `src-widgets/vite.config.ts` | template, 4 lines changed (widget name and exposed file) |
| `src-widgets/tsconfig.json`, `tsconfig.node.json`, `index.html` | template, unchanged |
| `src-widgets/src/translations.js` | structure from the template, own content |

### Libraries (installed via npm, not part of this repository)

| Package | Used for |
|---|---|
| [`@iobroker/adapter-core`](https://github.com/ioBroker/adapter-core) | official ioBroker adapter base class (objects, states, logging) – `main.js` extends it |
| [`modbus-serial`](https://github.com/yaacov/node-modbus-serial) | Modbus TCP communication |
| React, Vite, `@module-federation/vite` | widget UI and build (the widget uses React provided by VIS-2 at runtime) |
