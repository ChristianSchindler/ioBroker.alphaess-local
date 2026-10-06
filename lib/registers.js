'use strict';

/**
 * AlphaESS Modbus register map (household storage, protocol V1.x).
 * Verified against a SMILE-T10-HV + BAT-8.2P.
 *
 * Registers are read in blocks to keep the number of requests low.
 * `poll`: 'fast' = every poll interval, 'slow' = every settings interval, 'once' = at start.
 */
const BLOCKS = [
    { id: 'grid', start: 0x0010, length: 0x23, poll: 'fast' }, // 0x0010 - 0x0032
    { id: 'battery', start: 0x0100, length: 0x2e, poll: 'fast' }, // 0x0100 - 0x012D
    { id: 'inverter', start: 0x0400, length: 0x41, poll: 'fast' }, // 0x0400 - 0x0440
    { id: 'system', start: 0x0800, length: 0x03, poll: 'slow' }, // 0x0800 - 0x0802
    { id: 'timeWindows', start: 0x084f, length: 0x13, poll: 'slow' }, // 0x084F - 0x0861
    { id: 'versions', start: 0x0640, length: 0x12, poll: 'once' }, // 0x0640 - 0x0651
    { id: 'ems', start: 0x0740, length: 0x10, poll: 'once' }, // 0x0740 - 0x074F
];

/** Channels (folders) shown in the object tree */
const CHANNELS = {
    overview: { en: 'Overview (power flow)', de: 'Übersicht (Energiefluss)' },
    grid: { en: 'Grid (smart meter)', de: 'Netz (Smart Meter)' },
    pv: { en: 'Photovoltaics', de: 'Photovoltaik' },
    battery: { en: 'Battery', de: 'Batterie' },
    'battery.cells': { en: 'Battery cells', de: 'Batteriezellen' },
    inverter: { en: 'Inverter', de: 'Wechselrichter' },
    'inverter.backup': { en: 'Backup output (EPS)', de: 'Notstromausgang (EPS)' },
    energy: { en: 'Energy', de: 'Energie' },
    'energy.today': { en: 'Energy today', de: 'Energie heute' },
    'energy.total': { en: 'Energy total (lifetime)', de: 'Energie gesamt' },
    settings: { en: 'Settings', de: 'Einstellungen' },
    'settings.charge': { en: 'Charge settings', de: 'Ladeeinstellungen' },
    'settings.discharge': { en: 'Discharge settings', de: 'Entladeeinstellungen' },
    device: { en: 'Device information', de: 'Geräteinformationen' },
};

const WORK_MODES = {
    0: 'Waiting',
    1: 'Online',
    2: 'UPS',
    3: 'Bypass',
    4: 'Error',
    5: 'DC',
    6: 'Self test',
    7: 'Check',
    8: 'Update master',
    9: 'Update slave',
    10: 'Update ARM',
};

const TIME_PERIOD_CONTROL = {
    0: 'Disabled',
    1: 'Charge windows enabled',
    2: 'Discharge windows enabled',
    3: 'Charge + discharge windows enabled',
};

/**
 * Register based states.
 * type: uint16 | int16 | uint32 | int32 | string (words = length)
 * write: true → writable when "enable control" is switched on in the instance settings
 */
const REGISTER_STATES = [
    // ---- Grid (smart meter at grid connection point) ----
    { id: 'grid.power', addr: 0x0021, type: 'int32', unit: 'W', role: 'value.power', name: 'Grid power (+ import / − export)' },
    { id: 'grid.power_l1', addr: 0x001b, type: 'int32', unit: 'W', role: 'value.power', name: 'Grid power L1' },
    { id: 'grid.power_l2', addr: 0x001d, type: 'int32', unit: 'W', role: 'value.power', name: 'Grid power L2' },
    { id: 'grid.power_l3', addr: 0x001f, type: 'int32', unit: 'W', role: 'value.power', name: 'Grid power L3' },
    { id: 'grid.voltage_l1', addr: 0x0014, type: 'uint16', unit: 'V', role: 'value.voltage', name: 'Grid voltage L1' },
    { id: 'grid.voltage_l2', addr: 0x0015, type: 'uint16', unit: 'V', role: 'value.voltage', name: 'Grid voltage L2' },
    { id: 'grid.voltage_l3', addr: 0x0016, type: 'uint16', unit: 'V', role: 'value.voltage', name: 'Grid voltage L3' },
    { id: 'grid.current_l1', addr: 0x0017, type: 'uint16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Grid current L1' },
    { id: 'grid.current_l2', addr: 0x0018, type: 'uint16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Grid current L2' },
    { id: 'grid.current_l3', addr: 0x0019, type: 'uint16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Grid current L3' },
    { id: 'grid.frequency', addr: 0x001a, type: 'uint16', scale: 0.01, unit: 'Hz', role: 'value.frequency', name: 'Grid frequency' },
    { id: 'grid.reactive_power', addr: 0x0029, type: 'int32', unit: 'var', role: 'value.power.reactive', name: 'Grid reactive power' },
    { id: 'grid.apparent_power', addr: 0x0031, type: 'int32', unit: 'VA', role: 'value.power', name: 'Grid apparent power' },

    // ---- Battery ----
    { id: 'battery.soc', addr: 0x0102, type: 'uint16', scale: 0.1, unit: '%', role: 'value.battery', name: 'State of charge' },
    { id: 'battery.soh', addr: 0x011b, type: 'uint16', scale: 0.1, unit: '%', role: 'value', name: 'State of health' },
    { id: 'battery.power', addr: 0x0126, type: 'int16', unit: 'W', role: 'value.power', name: 'Battery power (+ discharge / − charge)' },
    { id: 'battery.voltage', addr: 0x0100, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Battery voltage' },
    { id: 'battery.current', addr: 0x0101, type: 'int16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Battery current' },
    { id: 'battery.capacity', addr: 0x0119, type: 'uint16', scale: 0.1, unit: 'kWh', role: 'value.energy', name: 'Battery capacity' },
    { id: 'battery.modules', addr: 0x0118, type: 'uint16', role: 'value', name: 'Number of battery modules' },
    { id: 'battery.status', addr: 0x0103, type: 'uint16', role: 'value', name: 'Battery status (raw)' },
    { id: 'battery.relay_status', addr: 0x0104, type: 'uint16', role: 'value', name: 'Battery relay status (raw)' },
    { id: 'battery.max_charge_current', addr: 0x0111, type: 'uint16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Max. charge current (BMS)' },
    { id: 'battery.max_discharge_current', addr: 0x0112, type: 'uint16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Max. discharge current (BMS)' },
    { id: 'battery.max_charge_power', addr: 0x012c, type: 'uint16', unit: 'W', role: 'value.power', name: 'Max. charge power (BMS)' },
    { id: 'battery.max_discharge_power', addr: 0x012d, type: 'uint16', unit: 'W', role: 'value.power', name: 'Max. discharge power (BMS)' },
    { id: 'battery.charge_cutoff_voltage', addr: 0x0113, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Charge cut-off voltage' },
    { id: 'battery.discharge_cutoff_voltage', addr: 0x0114, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Discharge cut-off voltage' },
    { id: 'battery.cells.min_voltage', addr: 0x0107, type: 'uint16', scale: 0.001, unit: 'V', role: 'value.voltage', name: 'Lowest cell voltage' },
    { id: 'battery.cells.max_voltage', addr: 0x010a, type: 'uint16', scale: 0.001, unit: 'V', role: 'value.voltage', name: 'Highest cell voltage' },
    { id: 'battery.cells.min_temperature', addr: 0x010d, type: 'int16', scale: 0.1, unit: '°C', role: 'value.temperature', name: 'Lowest cell temperature' },
    { id: 'battery.cells.max_temperature', addr: 0x0110, type: 'int16', scale: 0.1, unit: '°C', role: 'value.temperature', name: 'Highest cell temperature' },

    // ---- Inverter ----
    { id: 'inverter.power', addr: 0x040c, type: 'int32', unit: 'W', role: 'value.power', name: 'Inverter AC power' },
    { id: 'inverter.power_l1', addr: 0x0406, type: 'int32', unit: 'W', role: 'value.power', name: 'Inverter power L1' },
    { id: 'inverter.power_l2', addr: 0x0408, type: 'int32', unit: 'W', role: 'value.power', name: 'Inverter power L2' },
    { id: 'inverter.power_l3', addr: 0x040a, type: 'int32', unit: 'W', role: 'value.power', name: 'Inverter power L3' },
    { id: 'inverter.voltage_l1', addr: 0x0400, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Inverter voltage L1' },
    { id: 'inverter.voltage_l2', addr: 0x0401, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Inverter voltage L2' },
    { id: 'inverter.voltage_l3', addr: 0x0402, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Inverter voltage L3' },
    { id: 'inverter.current_l1', addr: 0x0403, type: 'int16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Inverter current L1' },
    { id: 'inverter.current_l2', addr: 0x0404, type: 'int16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Inverter current L2' },
    { id: 'inverter.current_l3', addr: 0x0405, type: 'int16', scale: 0.1, unit: 'A', role: 'value.current', name: 'Inverter current L3' },
    { id: 'inverter.frequency', addr: 0x041c, type: 'uint16', scale: 0.01, unit: 'Hz', role: 'value.frequency', name: 'Inverter frequency' },
    { id: 'inverter.temperature', addr: 0x0435, type: 'int16', scale: 0.1, unit: '°C', role: 'value.temperature', name: 'Inverter temperature' },
    { id: 'inverter.work_mode', addr: 0x0440, type: 'uint16', role: 'value', name: 'Work mode', states: WORK_MODES },
    { id: 'inverter.backup.voltage_l1', addr: 0x040e, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Backup voltage L1' },
    { id: 'inverter.backup.voltage_l2', addr: 0x040f, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Backup voltage L2' },
    { id: 'inverter.backup.voltage_l3', addr: 0x0410, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: 'Backup voltage L3' },
    { id: 'inverter.backup.power', addr: 0x041a, type: 'int32', unit: 'W', role: 'value.power', name: 'Backup power' },

    // ---- Lifetime energy counters ----
    { id: 'energy.total.grid_feed_in', addr: 0x0010, type: 'uint32', scale: 0.01, unit: 'kWh', role: 'value.energy.produced', name: 'Grid feed-in total' },
    { id: 'energy.total.grid_consumption', addr: 0x0012, type: 'uint32', scale: 0.01, unit: 'kWh', role: 'value.energy.consumed', name: 'Grid consumption total' },
    { id: 'energy.total.pv', addr: 0x043e, type: 'uint32', scale: 0.1, unit: 'kWh', role: 'value.energy.produced', name: 'PV generation total' },
    { id: 'energy.total.battery_charge', addr: 0x0120, type: 'uint32', scale: 0.1, unit: 'kWh', role: 'value.energy', name: 'Battery charge total' },
    { id: 'energy.total.battery_discharge', addr: 0x0122, type: 'uint32', scale: 0.1, unit: 'kWh', role: 'value.energy', name: 'Battery discharge total' },
    { id: 'energy.total.battery_charge_from_grid', addr: 0x0124, type: 'uint32', scale: 0.1, unit: 'kWh', role: 'value.energy', name: 'Battery charged from grid total' },

    // ---- Settings ----
    { id: 'settings.max_feed_in', addr: 0x0800, type: 'uint16', unit: '%', role: 'level', name: 'Max. feed-in to grid', write: true, min: 0, max: 100 },
    { id: 'settings.pv_capacity', addr: 0x0801, type: 'uint32', unit: 'W', role: 'value.power', name: 'Installed PV capacity' },
    { id: 'settings.time_period_control', addr: 0x084f, type: 'uint16', role: 'level', name: 'Charge/discharge time windows', write: true, min: 0, max: 3, states: TIME_PERIOD_CONTROL },
    { id: 'settings.charge.cutoff_soc', addr: 0x0855, type: 'uint16', unit: '%', role: 'level', name: 'Charging stops at SOC', write: true, min: 10, max: 100 },
    { id: 'settings.charge.window1_start', addr: 0x0856, minuteAddr: 0x085e, type: 'time', role: 'text', name: 'Charge window 1 start', write: true },
    { id: 'settings.charge.window1_end', addr: 0x0857, minuteAddr: 0x085f, type: 'time', role: 'text', name: 'Charge window 1 end', write: true },
    { id: 'settings.charge.window2_start', addr: 0x0858, minuteAddr: 0x0860, type: 'time', role: 'text', name: 'Charge window 2 start', write: true },
    { id: 'settings.charge.window2_end', addr: 0x0859, minuteAddr: 0x0861, type: 'time', role: 'text', name: 'Charge window 2 end', write: true },
    { id: 'settings.discharge.cutoff_soc', addr: 0x0850, type: 'uint16', unit: '%', role: 'level', name: 'Discharging stops at SOC', write: true, min: 0, max: 100 },
    { id: 'settings.discharge.window1_start', addr: 0x0851, minuteAddr: 0x085a, type: 'time', role: 'text', name: 'Discharge window 1 start', write: true },
    { id: 'settings.discharge.window1_end', addr: 0x0852, minuteAddr: 0x085b, type: 'time', role: 'text', name: 'Discharge window 1 end', write: true },
    { id: 'settings.discharge.window2_start', addr: 0x0853, minuteAddr: 0x085c, type: 'time', role: 'text', name: 'Discharge window 2 start', write: true },
    { id: 'settings.discharge.window2_end', addr: 0x0854, minuteAddr: 0x085d, type: 'time', role: 'text', name: 'Discharge window 2 end', write: true },

    // ---- Device information ----
    { id: 'device.inverter_sn', addr: 0x064a, type: 'string', words: 8, role: 'info.serial', name: 'Inverter serial number' },
    { id: 'device.arm_version', addr: 0x0640, type: 'string', words: 5, role: 'info.firmware', name: 'Inverter ARM firmware' },
    { id: 'device.dsp_version', addr: 0x0645, type: 'string', words: 5, role: 'info.firmware', name: 'Inverter DSP firmware' },
    { id: 'device.ems_sn', addr: 0x0743, type: 'string', words: 8, role: 'info.serial', name: 'EMS / system serial number' },
    { id: 'device.bmu_version', addr: 0x0115, type: 'uint16', role: 'info.firmware', name: 'Battery BMU firmware' },
];

/** PV string registers: voltage, current, power (uint32). String n starts at 0x041D + 4 * (n - 1). */
function pvStringStates(count) {
    const states = [];
    for (let n = 1; n <= count; n++) {
        const base = 0x041d + 4 * (n - 1);
        states.push(
            { id: `pv.string${n}.voltage`, addr: base, type: 'uint16', scale: 0.1, unit: 'V', role: 'value.voltage', name: `PV string ${n} voltage` },
            { id: `pv.string${n}.current`, addr: base + 1, type: 'uint16', scale: 0.1, unit: 'A', role: 'value.current', name: `PV string ${n} current` },
            { id: `pv.string${n}.power`, addr: base + 2, type: 'uint32', unit: 'W', role: 'value.power', name: `PV string ${n} power` },
        );
    }
    return states;
}

/** States calculated by the adapter (not read directly from a register) */
const CALCULATED_STATES = [
    { id: 'overview.pv_power', unit: 'W', role: 'value.power', name: 'PV power' },
    { id: 'overview.load_power', unit: 'W', role: 'value.power.consumption', name: 'House consumption' },
    { id: 'overview.grid_power', unit: 'W', role: 'value.power', name: 'Grid power (+ import / − export)' },
    { id: 'overview.battery_power', unit: 'W', role: 'value.power', name: 'Battery power (+ discharge / − charge)' },
    { id: 'overview.battery_soc', unit: '%', role: 'value.battery', name: 'Battery state of charge' },
    { id: 'overview.grid_import', unit: 'W', role: 'value.power', name: 'Grid import' },
    { id: 'overview.grid_export', unit: 'W', role: 'value.power', name: 'Grid export (feed-in)' },
    { id: 'overview.battery_charge', unit: 'W', role: 'value.power', name: 'Battery charging power' },
    { id: 'overview.battery_discharge', unit: 'W', role: 'value.power', name: 'Battery discharging power' },
    { id: 'overview.autarky', unit: '%', role: 'value', name: 'Self-sufficiency (now)' },
    { id: 'overview.self_consumption', unit: '%', role: 'value', name: 'Self-consumption (now)' },
    { id: 'pv.power', unit: 'W', role: 'value.power', name: 'PV power total' },
    { id: 'battery.cells.voltage_spread', unit: 'mV', role: 'value', name: 'Cell voltage spread (max − min)' },
    { id: 'energy.total.consumption', unit: 'kWh', role: 'value.energy.consumed', name: 'House consumption total (calculated)' },
    { id: 'energy.today.since', role: 'date', name: 'Daily values counted since (midnight, or adapter start on the first day)' },
    { id: 'energy.today.pv', unit: 'kWh', role: 'value.energy.produced', name: 'PV generation today' },
    { id: 'energy.today.consumption', unit: 'kWh', role: 'value.energy.consumed', name: 'House consumption today' },
    { id: 'energy.today.grid_feed_in', unit: 'kWh', role: 'value.energy.produced', name: 'Grid feed-in today' },
    { id: 'energy.today.grid_consumption', unit: 'kWh', role: 'value.energy.consumed', name: 'Grid consumption today' },
    { id: 'energy.today.battery_charge', unit: 'kWh', role: 'value.energy', name: 'Battery charge today' },
    { id: 'energy.today.battery_discharge', unit: 'kWh', role: 'value.energy', name: 'Battery discharge today' },
    { id: 'energy.today.autarky', unit: '%', role: 'value', name: 'Self-sufficiency today' },
    { id: 'energy.today.self_consumption', unit: '%', role: 'value', name: 'Self-consumption today' },
];

module.exports = { BLOCKS, CHANNELS, REGISTER_STATES, CALCULATED_STATES, pvStringStates };
