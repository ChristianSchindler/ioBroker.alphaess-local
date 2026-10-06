import React from 'react';

/** Data points of the alphaess-local adapter used by this widget (relative to the instance) */
const DATA_POINTS = {
    oid_pv: 'overview.pv_power',
    oid_load: 'overview.load_power',
    oid_grid: 'overview.grid_power',
    oid_battery: 'overview.battery_power',
    oid_soc: 'overview.battery_soc',
    oid_pv_today: 'energy.today.pv',
    oid_load_today: 'energy.today.consumption',
    oid_feed_today: 'energy.today.grid_feed_in',
    oid_import_today: 'energy.today.grid_consumption',
    oid_autarky_today: 'energy.today.autarky',
    oid_connection: 'info.connection',
};

const COLORS = {
    pv: '#fbbf24',
    battery: '#34d399',
    house: '#a78bfa',
    gridImport: '#fb7185',
    gridExport: '#38bdf8',
};

/** Minimum power (W) for a flow to be shown as active */
const ACTIVE_THRESHOLD = 15;

const CSS = `
.aess-root { width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
  border-radius: 22px; padding: 14px 16px 12px; overflow: hidden; position: relative;
  font-family: 'Inter', 'Segoe UI', Roboto, system-ui, sans-serif; color: var(--aess-text); }
.aess-dark { --aess-text: #e2e8f0; --aess-muted: #94a3b8; --aess-node: rgba(30, 41, 59, 0.85); --aess-line: rgba(148, 163, 184, 0.18);
  --aess-chip: rgba(255, 255, 255, 0.05); --aess-border: rgba(255, 255, 255, 0.08);
  background: radial-gradient(120% 90% at 50% 0%, #1e293b 0%, #0f172a 60%, #020617 100%);
  box-shadow: 0 10px 40px rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06); }
.aess-light { --aess-text: #0f172a; --aess-muted: #64748b; --aess-node: #ffffff; --aess-line: rgba(100, 116, 139, 0.22);
  --aess-chip: rgba(15, 23, 42, 0.04); --aess-border: rgba(15, 23, 42, 0.08);
  background: linear-gradient(160deg, #ffffff 0%, #f1f5f9 100%);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12), inset 0 1px 0 #fff; }
.aess-transparent { --aess-text: #e2e8f0; --aess-muted: #94a3b8; --aess-node: rgba(15, 23, 42, 0.55); --aess-line: rgba(148, 163, 184, 0.22);
  --aess-chip: rgba(255, 255, 255, 0.06); --aess-border: rgba(255, 255, 255, 0.1); background: transparent; }
.aess-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.aess-title { font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
.aess-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--aess-muted); }
.aess-dot { width: 8px; height: 8px; border-radius: 50%; }
.aess-dot.on { background: #22c55e; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); animation: aess-pulse 2s infinite; }
.aess-dot.off { background: #ef4444; }
.aess-svg { flex: 1; min-height: 0; width: 100%; }
.aess-flow { fill: none; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 0.1 14; animation: aess-flow linear infinite; }
.aess-flow.rev { animation-direction: reverse; }
.aess-value { font-size: 17px; font-weight: 700; fill: var(--aess-text); }
.aess-label { font-size: 11px; font-weight: 500; fill: var(--aess-muted); letter-spacing: 0.6px; text-transform: uppercase; }
.aess-sub { font-size: 11px; font-weight: 600; }
.aess-btn { cursor: pointer; outline: none; }
.aess-btn > g { transition: transform 0.18s ease, filter 0.18s ease; transform-box: fill-box; transform-origin: center; }
.aess-btn:hover > g, .aess-btn:focus-visible > g { transform: scale(1.06); filter: brightness(1.15); }
.aess-btn:active > g { transform: scale(0.97); }
.aess-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 6px; }
.aess-chip { background: var(--aess-chip); border: 1px solid var(--aess-border); border-radius: 12px; padding: 6px 8px; min-width: 0; }
.aess-chip-label { font-size: 10px; color: var(--aess-muted); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aess-chip-value { font-size: 14px; font-weight: 700; margin-top: 2px; white-space: nowrap; }
.aess-chip-value small { font-size: 10px; font-weight: 500; color: var(--aess-muted); margin-left: 2px; }
@keyframes aess-flow { from { stroke-dashoffset: 14.1; } to { stroke-dashoffset: 0; } }
@keyframes aess-pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); } 70% { box-shadow: 0 0 0 7px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
`;

const ICONS = {
    pv: (
        <g>
            <circle cx="0" cy="-4" r="5" fill={COLORS.pv} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
                <line
                    key={a}
                    x1="0"
                    y1="-12"
                    x2="0"
                    y2="-15"
                    stroke={COLORS.pv}
                    strokeWidth="2"
                    strokeLinecap="round"
                    transform={`rotate(${a} 0 -4)`}
                />
            ))}
            <path d="M-12 14 L-8 6 H8 L12 14 Z" fill="none" stroke={COLORS.pv} strokeWidth="2" strokeLinejoin="round" />
            <line x1="0" y1="6" x2="0" y2="14" stroke={COLORS.pv} strokeWidth="1.5" />
        </g>
    ),
    grid: color => (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            <path d="M-8 15 L-3 -13 H3 L8 15" />
            <path d="M-12 -7 H12 M-10 1 H10 M-6 -13 L0 -17 L6 -13" />
            <path d="M-6 8 L5 1 M6 8 L-5 1" />
        </g>
    ),
    house: (
        <g fill="none" stroke={COLORS.house} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            <path d="M-13 -1 L0 -13 L13 -1" />
            <path d="M-9 -4 V13 H9 V-4" />
            <path d="M-3 13 V5 H3 V13" />
        </g>
    ),
    battery: (soc, color) => (
        <g>
            <rect x="-8" y="-12" width="16" height="26" rx="3" fill="none" stroke={color} strokeWidth="2" />
            <rect x="-3.5" y="-15.5" width="7" height="3.5" rx="1" fill={color} />
            <rect
                x="-5"
                y={11 - (20 * soc) / 100}
                width="10"
                height={(20 * soc) / 100}
                rx="1.5"
                fill={color}
                opacity="0.85"
            />
        </g>
    ),
};

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
}

function formatPower(w) {
    if (w === null) {
        return '–';
    }
    const a = Math.abs(w);
    if (a >= 1000) {
        return `${(a / 1000).toFixed(a >= 10000 ? 1 : 2)} kW`;
    }
    return `${Math.round(a)} W`;
}

function formatEnergy(kwh) {
    if (kwh === null) {
        return ['–', ''];
    }
    return [kwh >= 100 ? kwh.toFixed(0) : kwh.toFixed(1), 'kWh'];
}

/** Animation duration: faster dots for higher power */
function flowDuration(w) {
    const a = Math.max(ACTIVE_THRESHOLD, Math.abs(w));
    return Math.max(0.45, 3.2 - Math.log10(a) * 0.7).toFixed(2);
}

export default class AlphaEssPowerFlow extends window.visRxWidget {
    static getWidgetInfo() {
        return {
            id: 'tplAlphaEssPowerFlow',
            visSet: 'alphaess-local',
            visSetIcon: 'widgets/alphaess-local/img/alphaess-local.svg',
            visSetLabel: 'set_label',
            visSetColor: '#f59e0b',
            visName: 'AlphaEssPowerFlow',
            visWidgetLabel: 'power_flow',
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        {
                            name: 'instance',
                            label: 'instance',
                            type: 'instance',
                            adapter: 'alphaess-local',
                            default: 'alphaess-local.0',
                            onChange: async (field, data, changeData) => {
                                const inst =
                                    data.instance && data.instance.includes('.')
                                        ? data.instance
                                        : `alphaess-local.${data.instance || 0}`;
                                Object.entries(DATA_POINTS).forEach(([key, path]) => {
                                    data[key] = `${inst}.${path}`;
                                });
                                changeData(data);
                            },
                        },
                        { name: 'title', label: 'title', type: 'text', default: 'Energiefluss' },
                        {
                            name: 'theme',
                            label: 'theme',
                            type: 'select',
                            options: ['dark', 'light', 'transparent'],
                            default: 'dark',
                        },
                        { name: 'showToday', label: 'show_today', type: 'checkbox', default: true },
                        { name: 'showStatus', label: 'show_status', type: 'checkbox', default: true },
                    ],
                },
                {
                    name: 'navigation',
                    label: 'navigation',
                    fields: [
                        { name: 'view_pv', label: 'view_pv', type: 'views' },
                        { name: 'view_grid', label: 'view_grid', type: 'views' },
                        { name: 'view_house', label: 'view_house', type: 'views' },
                        { name: 'view_battery', label: 'view_battery', type: 'views' },
                    ],
                },
                {
                    name: 'datapoints',
                    label: 'datapoints',
                    fields: Object.entries(DATA_POINTS).map(([key, path]) => ({
                        name: key,
                        label: key,
                        type: 'id',
                        default: `alphaess-local.0.${path}`,
                    })),
                },
            ],
            visDefaultStyle: { width: 440, height: 420 },
            visPrev: 'widgets/alphaess-local/img/preview.svg',
        };
    }

    // Do not delete: used by vis to read the widget configuration
    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo() {
        return AlphaEssPowerFlow.getWidgetInfo();
    }

    // translations.js has `prefix: true` → vis-2 prefixes all keys with "<adapter>_"
    static getI18nPrefix() {
        return `${AlphaEssPowerFlow.adapter}_`;
    }

    val(key) {
        const oid = this.state.rxData[key];
        return oid ? this.state.values[`${oid}.val`] : undefined;
    }

    /** Wraps a node so it switches to the configured VIS view when clicked (not in edit mode) */
    renderButton(key, children) {
        const view = this.state.rxData[`view_${key}`];
        if (!view || this.props.editMode) {
            return children;
        }
        const go = () => this.props.context.changeView(view);
        return (
            <g
                className="aess-btn"
                role="button"
                tabIndex={0}
                onClick={go}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && go()}
            >
                <title>{view}</title>
                <g>{children}</g>
            </g>
        );
    }

    /** `side`: put label + value right of the node instead of above/below (keeps the flow line free) */
    renderNode(x, y, color, icon, label, value, sub, subColor, side) {
        return (
            <g transform={`translate(${x} ${y})`}>
                <circle r="34" fill={color} opacity="0.12" filter="url(#aess-glow)" />
                <circle r="30" fill="var(--aess-node)" stroke={color} strokeWidth="2" strokeOpacity="0.9" />
                {icon}
                <text
                    className="aess-label"
                    x={side ? 44 : 0}
                    y={side ? -6 : -42}
                    textAnchor={side ? 'start' : 'middle'}
                >
                    {label}
                </text>
                <text
                    className="aess-value"
                    x={side ? 44 : 0}
                    y={side ? 15 : 56}
                    textAnchor={side ? 'start' : 'middle'}
                >
                    {value}
                </text>
                {sub ? (
                    <text className="aess-sub" y="71" textAnchor="middle" fill={subColor || 'var(--aess-muted)'}>
                        {sub}
                    </text>
                ) : null}
            </g>
        );
    }

    /** Line between two points; `forward` = energy moves from first to second point */
    renderFlow(d, power, color, forward) {
        const active = power !== null && Math.abs(power) >= ACTIVE_THRESHOLD;
        return (
            <g>
                <path d={d} fill="none" stroke="var(--aess-line)" strokeWidth="3" strokeLinecap="round" />
                {active ? (
                    <path
                        d={d}
                        className={`aess-flow${forward ? '' : ' rev'}`}
                        stroke={color}
                        style={{
                            animationDuration: `${flowDuration(power)}s`,
                            filter: `drop-shadow(0 0 4px ${color})`,
                        }}
                    />
                ) : null}
            </g>
        );
    }

    renderChip(label, [value, unit], color) {
        return (
            <div className="aess-chip">
                <div className="aess-chip-label">{label}</div>
                <div className="aess-chip-value" style={{ color }}>
                    {value}
                    <small>{unit}</small>
                </div>
            </div>
        );
    }

    renderWidgetBody(props) {
        super.renderWidgetBody(props);
        // t() must be called on the class: vis-2 resolves the i18n prefix via `this`
        const t = key => AlphaEssPowerFlow.t(key);
        const d = this.state.rxData;

        const pv = num(this.val('oid_pv'));
        const load = num(this.val('oid_load'));
        const grid = num(this.val('oid_grid')); // + import / - export
        const bat = num(this.val('oid_battery')); // + discharge / - charge
        const soc = num(this.val('oid_soc'));
        const connected = this.val('oid_connection');

        const importing = grid !== null && grid > 0;
        const gridColor = importing ? COLORS.gridImport : COLORS.gridExport;
        const charging = bat !== null && bat < 0;
        const socColor = soc === null ? COLORS.battery : soc < 15 ? '#f87171' : soc < 35 ? '#fbbf24' : COLORS.battery;

        // SOC ring around the battery node
        const ringR = 36;
        const ringLen = 2 * Math.PI * ringR;
        const ringFill = ((soc || 0) / 100) * ringLen;

        const theme = ['dark', 'light', 'transparent'].includes(d.theme) ? d.theme : 'dark';
        const showToday = d.showToday !== false;

        // Layout (viewBox 400 x 345): PV top, grid left, house right, battery bottom, hub in the middle
        const hub = { x: 200, y: 165 };
        const P = {
            pv: { x: 200, y: 48 },
            grid: { x: 62, y: 165 },
            house: { x: 338, y: 165 },
            bat: { x: 200, y: 268 },
        };

        return (
            <div className={`aess-root aess-${theme}`}>
                <style>{CSS}</style>
                {d.title || d.showStatus !== false ? (
                    <div className="aess-header">
                        <div className="aess-title">{d.title}</div>
                        {d.showStatus !== false ? (
                            <div className="aess-status">
                                <span className={`aess-dot ${connected === false ? 'off' : 'on'}`} />
                                {connected === false ? t('offline') : t('live')}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <svg className="aess-svg" viewBox="0 0 400 345" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <filter id="aess-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="6" />
                        </filter>
                        <radialGradient id="aess-hub" cx="50%" cy="40%" r="60%">
                            <stop offset="0%" stopColor="#64748b" />
                            <stop offset="100%" stopColor="#1e293b" />
                        </radialGradient>
                    </defs>

                    {this.renderFlow(`M${P.pv.x} ${P.pv.y + 34} L${hub.x} ${hub.y - 14}`, pv, COLORS.pv, true)}
                    {this.renderFlow(
                        `M${P.grid.x + 34} ${P.grid.y} L${hub.x - 14} ${hub.y}`,
                        grid,
                        gridColor,
                        importing,
                    )}
                    {this.renderFlow(
                        `M${hub.x + 14} ${hub.y} L${P.house.x - 34} ${P.house.y}`,
                        load,
                        COLORS.house,
                        true,
                    )}
                    {this.renderFlow(
                        `M${P.bat.x} ${P.bat.y - 40} L${hub.x} ${hub.y + 14}`,
                        bat,
                        COLORS.battery,
                        !charging,
                    )}

                    <circle
                        cx={hub.x}
                        cy={hub.y}
                        r="14"
                        fill="url(#aess-hub)"
                        stroke="var(--aess-line)"
                        strokeWidth="2"
                    />
                    <circle
                        cx={hub.x}
                        cy={hub.y}
                        r="4"
                        fill={COLORS.pv}
                        opacity={pv && pv > ACTIVE_THRESHOLD ? 1 : 0.3}
                    />

                    {this.renderButton(
                        'pv',
                        this.renderNode(
                            P.pv.x,
                            P.pv.y,
                            COLORS.pv,
                            ICONS.pv,
                            t('solar'),
                            formatPower(pv),
                            null,
                            null,
                            true,
                        ),
                    )}
                    {this.renderButton(
                        'grid',
                        this.renderNode(
                            P.grid.x,
                            P.grid.y,
                            gridColor,
                            ICONS.grid(gridColor),
                            t('grid'),
                            formatPower(grid),
                            grid === null || Math.abs(grid) < ACTIVE_THRESHOLD
                                ? t('idle')
                                : importing
                                  ? t('import')
                                  : t('export'),
                            gridColor,
                        ),
                    )}
                    {this.renderButton(
                        'house',
                        this.renderNode(P.house.x, P.house.y, COLORS.house, ICONS.house, t('house'), formatPower(load)),
                    )}

                    {this.renderButton(
                        'battery',
                        <g>
                            <g transform={`translate(${P.bat.x} ${P.bat.y})`}>
                                <circle r={ringR} fill="none" stroke="var(--aess-line)" strokeWidth="4" />
                                <circle
                                    r={ringR}
                                    fill="none"
                                    stroke={socColor}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={`${ringFill} ${ringLen}`}
                                    transform="rotate(-90)"
                                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                                />
                            </g>
                            {this.renderNode(
                                P.bat.x,
                                P.bat.y,
                                socColor,
                                ICONS.battery(soc || 0, socColor),
                                '',
                                soc === null ? '–' : `${Math.round(soc)} %`,
                                bat === null || Math.abs(bat) < ACTIVE_THRESHOLD
                                    ? t('standby')
                                    : `${charging ? t('charging') : t('discharging')} ${formatPower(bat)}`,
                                socColor,
                            )}
                        </g>,
                    )}
                </svg>

                {showToday ? (
                    <div className="aess-chips">
                        {this.renderChip(t('today_pv'), formatEnergy(num(this.val('oid_pv_today'))), COLORS.pv)}
                        {this.renderChip(t('today_load'), formatEnergy(num(this.val('oid_load_today'))), COLORS.house)}
                        {this.renderChip(
                            t('today_feed'),
                            formatEnergy(num(this.val('oid_feed_today'))),
                            COLORS.gridExport,
                        )}
                        {this.renderChip(
                            t('today_autarky'),
                            [
                                num(this.val('oid_autarky_today')) === null
                                    ? '–'
                                    : Math.round(num(this.val('oid_autarky_today'))),
                                '%',
                            ],
                            COLORS.battery,
                        )}
                    </div>
                ) : null}
            </div>
        );
    }
}
