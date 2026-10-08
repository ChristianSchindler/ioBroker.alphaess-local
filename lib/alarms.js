'use strict';

/**
 * Meaning of the warning / fault bits, from the AlphaESS "Modbus register parameter list" (household storage),
 * Notes 4, 26, 28 and 32. The tables of the EMS3.5/EMS3.6 platform are used: the inverter tables exist only for
 * it, and for the battery the EMS2.5 table differs. Index = bit number, empty = reserved.
 */
const BATTERY_WARNING = [
    'Temperature imbalance',
    'Over temperature',
    'Discharge low temperature',
    'Charge low temperature',
    'Discharge over current',
    'Charge over current',
    'Cell over voltage',
    'Cell low voltage',
    'Software versions inconsistent',
    'MOS temperature sensor error',
    'SOC inconsistent',
    'BMS communication lost',
    'BMS fan error',
];

const BATTERY_FAULT = [
    'Temperature sensor error',
    'MOS error',
    'Circuit breaker open',
    'Dial switch mode inconsistent',
    'Slave battery communication lost',
    'SN missing',
    'Master battery communication lost',
    'Firmware versions inconsistent',
    'Multi master error',
    'MOS high temperature',
    'Insulation fault',
    'Total voltage abnormal',
    'MOS feedback failure',
    'Pre-charge failure',
    '17823 communication failure',
    '17841 communication failure',
    'MOS temperature sensor error',
];

const INVERTER_WARNING_1 = [
    'bat_over_voltage_alarm', 'bat_under_voltage_alarm', 'output_overload_alarm', 'abnormal_temperature_sensor',
    'dc_power_alarm', 'battery_stops_running_alarm', 'over_temperature_alarm', 'pv_volt_high_alarm',
    'bat_open_alarm', 'bat_reverse_alarm', 'bus_over_alarm', 'grid_loss_alarm',
    'grid_volt_alarm', 'grid_freq_alarm', '10min_grid_volt_alarm', 'grid_volt_inst_over',
    'pe_loss_alarm', 'ln_reverse', 'low_temper_alarm', 'gfci_alarm',
    'iso_alarm', 'dci_alarm', 'dcv_alarm', 'island_alarm',
    'fan_abnormal_alarm', 'n_loss_alarm', 'ems_sci_alarm', 'ems_can_alarm',
    'flashid_alarm', 'read_flash_alarm', 'write_flash_alarm', 'machine_type_alarm',
];

const INVERTER_WARNING_2 = [
    'inv_volt_low_alarm', 'inv_over_curr_sw_alarm', 'inv_over_curr_hw_alarm', 'bst_over_curr_sw_alarm',
    'bst_over_curr_hw_alarm', 'buck_bst_over_curr_sw_alarm', 'buck_bst_over_curr_hw_alarm', 'bus_under',
    'no_pv_input_alarm', 'input_power_limit_alarm', 'output_power_limit_alarm', 'reduce_pby_over_freq_alarm',
    'reduce_pby_over_volt_alarm', 'reduce_pby_over_temp_alarm', 'hvrt_alarm', 'lvrt_alarm',
    'ntc_fail_alarm', 'grid_waveform_abnormal_alarm', 'eps_capacitance_decrease', 'para_alarm',
    'para_error_location', 'para_avg_overload', 'para_module_addr_same', 'para_online_enter_fail',
    'para_unbalance_power', 'para_turnon_inconsistent', 'grid_backup_n_lost', 'bat_num_abnormal',
    'grid_phase_order_fault', 'dcv_sample_abnormal', 'blackbox_flash_fault', 'rtc_fault',
];

const INVERTER_FAULT_1 = [
    'Grid_OVP', 'Grid_UVP', 'Grid_OFP', 'Grid_UFP',
    'phase_locked_fault', 'bus_ovp1', 'bus_ovp2', 'insulation_fault',
    'gfci_fault', 'gfci_test_fault', 'grid_relay_fault', 'over_temperature',
    'pv_reverse', 'bat_reverse', 'm_s_com_fault', 'display_com_fault',
    'chip1_upgrade_fault', 'mppt1_ovp', 'mppt1_sw_ocp', 'mppt1_hw_ocp',
    'mppt1_otp', 'mppt2_ovp', 'mppt2_sw_ocp', 'mppt2_hw_ocp',
    'mppt2_otp', 'bat_ovp', 'bat_uvp', 'battery_lose',
    'bat_otp', 'bat1_charge_ocp', 'bat1_discharge_ocp', 'bat2_charge_ocp',
];

const INVERTER_FAULT_2 = [
    'bat2_discharge_ocp', 'bat1_hw_ocp', 'bat2_hw_ocp', 'inv_otp',
    'inv_ovp', 'inv_uvp', 'output_dc_over_current', 'inv_ocp',
    'inv_hw_ocp', 'output_dc_over_voltage', 'output_short', 'output_overload',
    'apu_uvp', 'bat_relay_fault', 'dc_input_disturbance', 'grid_disturbance',
    'grid_unbalance', 'freq_jitter', 'grid_overcurrent', 'grid_current_track_fault',
    'backup_ovp', 'dc_bus_unbalancevolt', 'dc_bus_undervolt', 'dc_bus_unbalancevolt2',
    'igbt_over_current', 'grid_disturbance2', 'afci_check_protect', 'grid_current_sampling_abnormal',
    'dsp_selfcheck', 'grid_short_time_over_current', 'bat_overvolt_hardware_fault', 'zero_ground_fault',
];

/** Warning / fault registers (bit fields, 0 = OK) combined into overview.alarm (1 = warning, 2 = fault) */
const ALARMS = [
    { id: 'battery.warning', level: 1, name: 'Battery warning', bits: BATTERY_WARNING },
    { id: 'battery.fault', level: 2, name: 'Battery fault', bits: BATTERY_FAULT },
    { id: 'inverter.warning_1', level: 1, name: 'Inverter warning', bits: INVERTER_WARNING_1 },
    { id: 'inverter.warning_2', level: 1, name: 'Inverter warning', bits: INVERTER_WARNING_2 },
    { id: 'inverter.fault_1', level: 2, name: 'Inverter fault', bits: INVERTER_FAULT_1 },
    { id: 'inverter.fault_2', level: 2, name: 'Inverter fault', bits: INVERTER_FAULT_2 },
];

/**
 * Names of the set bits, e.g. 0x81 → ['Temperature imbalance', 'Cell low voltage']
 *
 * @param {number} value register value
 * @param {string[]} names bit names (index = bit)
 */
function bitNames(value, names) {
    const out = [];
    for (let bit = 0; bit < 32; bit++) {
        if (Math.floor(value / 2 ** bit) % 2) {
            out.push(names[bit] ? names[bit].replace(/_/g, ' ') : `bit ${bit}`);
        }
    }
    return out;
}

module.exports = { ALARMS, bitNames };
