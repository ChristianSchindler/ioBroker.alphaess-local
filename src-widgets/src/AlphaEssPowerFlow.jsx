import React from 'react';
import { createPortal } from 'react-dom';

/** Data points of the alphaess-local adapter used by this widget (relative to the instance) */
const DATA_POINTS = {
    oid_pv: 'overview.pv_power',
    oid_load: 'overview.load_power',
    oid_grid: 'overview.grid_power',
    oid_battery: 'overview.battery_power',
    oid_soc: 'overview.battery_soc',
    oid_backup: 'inverter.backup.power',
    oid_pv_today: 'energy.today.pv',
    oid_load_today: 'energy.today.consumption',
    oid_feed_today: 'energy.today.grid_feed_in',
    oid_import_today: 'energy.today.grid_consumption',
    oid_autarky_today: 'energy.today.autarky',
    oid_connection: 'info.connection',
    oid_alarm: 'overview.alarm',
    oid_alarm_text: 'overview.alarm_text',
};

const COLORS = {
    pv: '#fbbf24',
    battery: '#34d399',
    house: '#a78bfa',
    gridImport: '#fb7185',
    gridExport: '#38bdf8',
    backup: '#f59e0b',
    wallbox: '#2dd4bf',
};

/** Minimum power (W) for a flow to be shown as active */
const ACTIVE_THRESHOLD = 15;

/** Wallbox data points: free choice (any wallbox adapter), so no defaults from this adapter */
const WALLBOX_POINTS = ['oid_wallbox', 'oid_wallbox_status', 'oid_wallbox_soc', 'oid_wallbox_today'];

/** Nodes that can open a view (attribute `view_<key>`, `popup_<key>` = in a popup instead of switching) */
const NAV_NODES = ['pv', 'grid', 'house', 'battery', 'wallbox'];

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
.aess-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
.aess-header > .aess-status { min-width: 0; }
.aess-title { font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
.aess-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--aess-muted); }
.aess-dot { width: 8px; height: 8px; border-radius: 50%; }
.aess-dot.on { background: #22c55e; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); animation: aess-pulse 2s infinite; }
.aess-dot.off { background: #ef4444; }
.aess-alarm { display: block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-right: 4px; }
.aess-alarm.warn { color: #f59e0b; background: rgba(245, 158, 11, 0.14); }
.aess-alarm.fault { color: #ef4444; background: rgba(239, 68, 68, 0.14); animation: aess-blink 1.6s ease-in-out infinite; }
@keyframes aess-blink { 50% { opacity: 0.55; } }
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
.aess-chips { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 6px; }
.aess-chip { background: var(--aess-chip); border: 1px solid var(--aess-border); border-radius: 12px; padding: 6px 7px; min-width: 0; }
.aess-chip-label { font-size: 9.5px; color: var(--aess-muted); text-transform: uppercase; letter-spacing: 0.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aess-chip-value { font-size: 14px; font-weight: 700; margin-top: 2px; white-space: nowrap; }
.aess-chip-value small { font-size: 10px; font-weight: 500; color: var(--aess-muted); margin-left: 2px; }
.aess-backdrop { position: fixed; inset: 0; z-index: 10000; background: rgba(2, 6, 23, 0.55); display: flex;
  align-items: center; justify-content: center; animation: aess-fade 0.15s ease; }
.aess-dialog { display: flex; flex-direction: column; max-width: 95vw; max-height: 95vh; border-radius: 18px; overflow: hidden;
  font-family: 'Inter', 'Segoe UI', Roboto, system-ui, sans-serif; color: var(--aess-text); }
.aess-dialog-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px 8px 16px;
  font-size: 15px; font-weight: 600; border-bottom: 1px solid var(--aess-border); }
.aess-close { border: 0; background: var(--aess-chip); color: var(--aess-text); width: 30px; height: 30px; border-radius: 50%;
  font-size: 18px; line-height: 30px; cursor: pointer; padding: 0; }
.aess-close:hover { filter: brightness(1.4); }
.aess-dialog-body { position: relative; flex: 1; min-height: 0; }
.aess-dialog-body > div { position: absolute; inset: 0; overflow: auto; }
@keyframes aess-fade { from { opacity: 0; } }
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
    wallbox: color => (
        <g fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            <rect x="-11" y="-14" width="15" height="28" rx="3" />
            <path d="M-2 -9 L-6 0 H-2 L-4 8" />
            <path d="M4 -3 H8 Q11 -3 11 0 V9 Q11 13 7 13" />
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

/** Line from a (node radius ra) to b (node radius rb), starting/ending at the node borders */
function link(a, ra, b, rb) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const at = (p, r) => `${(p.x + (dx * r) / len).toFixed(1)} ${(p.y + (dy * r) / len).toFixed(1)}`;
    return `M${at(a, ra)} L${at(b, -rb)}`;
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
                        { name: 'title', label: 'title', type: 'text', default: 'Power flow' },
                        {
                            name: 'theme',
                            label: 'theme',
                            type: 'select',
                            options: [
                                { value: 'auto', label: 'theme_auto' },
                                { value: 'dark', label: 'theme_dark' },
                                { value: 'light', label: 'theme_light' },
                                { value: 'transparent', label: 'theme_transparent' },
                            ],
                            default: 'auto',
                        },
                        { name: 'showToday', label: 'show_today', type: 'checkbox', default: true },
                        { name: 'showStatus', label: 'show_status', type: 'checkbox', default: true },
                    ],
                },
                {
                    name: 'navigation',
                    label: 'navigation',
                    fields: [
                        ...NAV_NODES.flatMap(key => [
                            { name: `view_${key}`, label: `view_${key}`, type: 'views' },
                            {
                                name: `popup_${key}`,
                                label: 'as_popup',
                                type: 'checkbox',
                                hidden: data => !data[`view_${key}`],
                            },
                        ]),
                        {
                            name: 'popupWidth',
                            label: 'popup_width',
                            type: 'number',
                            default: 800,
                            hidden: data => !NAV_NODES.some(key => data[`view_${key}`] && data[`popup_${key}`]),
                        },
                        {
                            name: 'popupHeight',
                            label: 'popup_height',
                            type: 'number',
                            default: 500,
                            hidden: data => !NAV_NODES.some(key => data[`view_${key}`] && data[`popup_${key}`]),
                        },
                    ],
                },
                {
                    // any wallbox (other adapter, script, alias) - not filled in by the instance;
                    // the wallbox node is only shown when its power data point is set
                    name: 'wallbox',
                    label: 'wallbox_group',
                    fields: [
                        { name: 'wallbox_label', label: 'wallbox_label', type: 'text', default: 'Wallbox' },
                        { name: 'oid_wallbox', label: 'oid_wallbox', type: 'id' },
                        {
                            name: 'wallbox_unit',
                            label: 'wallbox_unit',
                            type: 'select',
                            options: [
                                { value: 'W', label: 'W' },
                                { value: 'kW', label: 'kW' },
                            ],
                            default: 'W',
                        },
                        {
                            name: 'wallboxInLoad',
                            label: 'wallbox_in_load',
                            tooltip: 'wallbox_in_load_tooltip',
                            type: 'checkbox',
                            default: true,
                        },
                        { name: 'oid_wallbox_status', label: 'oid_wallbox_status', type: 'id' },
                        { name: 'oid_wallbox_soc', label: 'oid_wallbox_soc', type: 'id' },
                        { name: 'oid_wallbox_today', label: 'oid_wallbox_today', type: 'id' },
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

    rootRef = React.createRef();

    // stable callback: focus only when the popup opens (Escape closes it), not on every value update
    focusPopup = el => el?.focus();

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
        const oid = this.oid(key);
        if (!oid) {
            return undefined;
        }
        const v = this.state.values[`${oid}.val`];
        return v !== undefined ? v : this.state.extraValues?.[oid];
    }

    /** Configured data point, or the default one of the instance (widgets created before the data point existed) */
    oid(key) {
        const d = this.state.rxData;
        if (d[key] !== undefined || WALLBOX_POINTS.includes(key)) {
            return d[key] && d[key] !== 'nothing_selected' ? d[key] : undefined;
        }
        const inst = (d.oid_pv || '').match(/^alphaess-local\.\d+/);
        return inst ? `${inst[0]}.${DATA_POINTS[key]}` : undefined;
    }

    /** vis-2 only subscribes to the data points of the widget attributes - add the ones of older widgets */
    componentDidMount() {
        super.componentDidMount?.();
        const ids = Object.keys(DATA_POINTS)
            .filter(key => this.state.rxData[key] === undefined)
            .map(key => this.oid(key))
            .filter(Boolean);
        if (ids.length && this.props.context?.socket) {
            this.extraIds = ids;
            this.onExtraState = (id, state) =>
                this.setState(s => ({ extraValues: { ...s.extraValues, [id]: state?.val } }));
            this.props.context.socket.subscribeState(ids, this.onExtraState);
        }
        this.detectBackground();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        super.componentDidUpdate?.(prevProps, prevState, snapshot);
        this.detectBackground();
    }

    /**
     * Theme "auto": light or dark like the background the widget actually sits on (view or container color).
     * Without an opaque background color (transparent, image) the light/dark theme of vis-2 decides.
     */
    detectBackground() {
        let bg = null;
        for (let el = this.rootRef.current?.parentElement; el && !bg; el = el.parentElement) {
            const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
            if (m && (m[3] === undefined || Number(m[3]) > 0.5)) {
                // relative luminance (sRGB weights) of the first opaque background
                const lum = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
                bg = lum < 0.5 ? 'dark' : 'light';
            }
        }
        if (bg !== this.state.autoTheme) {
            this.setState({ autoTheme: bg });
        }
    }

    componentWillUnmount() {
        super.componentWillUnmount?.();
        if (this.extraIds) {
            this.props.context.socket.unsubscribeState(this.extraIds, this.onExtraState);
        }
    }

    /** Wraps a node so it switches to the configured VIS view when clicked (not in edit mode) */
    renderButton(key, children) {
        const view = this.state.rxData[`view_${key}`];
        if (!view || this.props.editMode) {
            return children;
        }
        // the own view inside the popup would contain this widget again → switch instead
        const go = () =>
            this.state.rxData[`popup_${key}`] && view !== this.props.view
                ? this.setState({ popupView: view })
                : this.props.context.changeView(view);
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

    /** View shown in a popup over the page (portal to body: not clipped by the widget or scaled views) */
    renderPopup(theme) {
        const view = this.state.popupView;
        if (!view || this.props.editMode || typeof this.getWidgetView !== 'function') {
            return null;
        }
        const d = this.state.rxData;
        const close = () => this.setState({ popupView: null });
        return createPortal(
            <div
                className="aess-backdrop"
                onClick={e => e.target === e.currentTarget && close()}
                onKeyDown={e => e.key === 'Escape' && close()}
                ref={this.focusPopup}
                tabIndex={-1}
            >
                <div
                    className={`aess-root aess-dialog aess-${theme === 'transparent' ? 'dark' : theme}`}
                    style={{ width: Number(d.popupWidth) || 800, height: Number(d.popupHeight) || 500, padding: 0 }}
                >
                    <div className="aess-dialog-head">
                        <span>{view}</span>
                        <button
                            type="button"
                            className="aess-close"
                            onClick={close}
                            title={AlphaEssPowerFlow.t('close')}
                        >
                            ×
                        </button>
                    </div>
                    <div className="aess-dialog-body">
                        <div>{this.getWidgetView(view)}</div>
                    </div>
                </div>
            </div>,
            document.body,
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

    renderWallbox(pos, power, t) {
        const d = this.state.rxData;
        const status = this.val('oid_wallbox_status');
        const soc = num(this.val('oid_wallbox_soc'));
        const parts = [];
        if (power !== null && power >= ACTIVE_THRESHOLD) {
            parts.push(t('charging'));
        } else if (typeof status === 'boolean') {
            parts.push(status ? t('wallbox_connected') : t('wallbox_disconnected'));
        } else if (status !== undefined && status !== null && status !== '') {
            parts.push(String(status));
        } else {
            parts.push(t('idle'));
        }
        if (soc !== null) {
            parts.push(`${Math.round(soc)} %`);
        }
        return this.renderNode(
            pos.x,
            pos.y,
            COLORS.wallbox,
            ICONS.wallbox(COLORS.wallbox),
            d.wallbox_label === undefined ? 'Wallbox' : d.wallbox_label,
            formatPower(power),
            parts.join(' · '),
            COLORS.wallbox,
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
        const backup = num(this.val('oid_backup')); // EPS output, not part of `load`
        const connected = this.val('oid_connection');
        // 1 = warning, 2 = fault; details (codes) as tooltip
        const alarm = num(this.val('oid_alarm')) || 0;
        const alarmText = this.val('oid_alarm_text') || '';

        // Wallbox (optional, any adapter): node only shown when its power data point is set
        const hasWallbox = !!this.oid('oid_wallbox');
        const wbRaw = hasWallbox ? num(this.val('oid_wallbox')) : null;
        const wallbox = wbRaw === null ? null : Math.abs(wbRaw) * (d.wallbox_unit === 'kW' ? 1000 : 1);
        // the inverter measures the whole house incl. wallbox → show the house without it
        const house =
            hasWallbox && d.wallboxInLoad !== false && load !== null && wallbox !== null
                ? Math.max(0, load - wallbox)
                : load;

        const importing = grid !== null && grid > 0;
        const gridColor = importing ? COLORS.gridImport : COLORS.gridExport;
        const charging = bat !== null && bat < 0;
        const socColor = soc === null ? COLORS.battery : soc < 15 ? '#f87171' : soc < 35 ? '#fbbf24' : COLORS.battery;

        // SOC ring around the battery node
        const ringR = 36;
        const ringLen = 2 * Math.PI * ringR;
        const ringFill = ((soc || 0) / 100) * ringLen;

        // auto: like the background the widget sits on, else like the light/dark theme of vis-2
        const theme = ['dark', 'light', 'transparent'].includes(d.theme)
            ? d.theme
            : this.state.autoTheme || (this.props.context?.themeType === 'light' ? 'light' : 'dark');
        const showToday = d.showToday !== false;

        // Layout (viewBox 400 x 345): PV top, grid left, house right, battery bottom, hub in the middle
        const hub = { x: 200, y: 165 };
        // with wallbox: house top right, wallbox bottom right
        const P = {
            pv: { x: 200, y: 48 },
            grid: { x: 62, y: 165 },
            house: hasWallbox ? { x: 338, y: 122 } : { x: 338, y: 165 },
            bat: { x: 200, y: 268 },
            wallbox: { x: 338, y: 262 },
        };

        return (
            <div className={`aess-root aess-${theme}`} ref={this.rootRef}>
                <style>{CSS}</style>
                {d.title || d.showStatus !== false || alarm ? (
                    <div className="aess-header">
                        <div className="aess-title">{d.title}</div>
                        <div className="aess-status">
                            {alarm ? (
                                <span className={`aess-alarm ${alarm >= 2 ? 'fault' : 'warn'}`} title={alarmText}>
                                    ⚠ {alarmText.replace(/ \(0x[0-9a-f]+\)/g, '') || (alarm >= 2 ? t('fault') : t('warning'))}
                                </span>
                            ) : null}
                            {d.showStatus !== false ? (
                                <>
                                    <span className={`aess-dot ${connected === false ? 'off' : 'on'}`} />
                                    {connected === false ? t('offline') : t('live')}
                                </>
                            ) : null}
                        </div>
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
                    {this.renderFlow(link(hub, 14, P.house, 34), house, COLORS.house, true)}
                    {hasWallbox ? this.renderFlow(link(hub, 14, P.wallbox, 34), wallbox, COLORS.wallbox, true) : null}
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
                        this.renderNode(
                            P.house.x,
                            P.house.y,
                            COLORS.house,
                            ICONS.house,
                            t('house'),
                            formatPower(house),
                            // only while the backup output is actually used
                            backup !== null && Math.abs(backup) >= ACTIVE_THRESHOLD
                                ? `${t('backup')} ${formatPower(backup)}`
                                : null,
                            COLORS.backup,
                        ),
                    )}

                    {hasWallbox ? this.renderButton('wallbox', this.renderWallbox(P.wallbox, wallbox, t)) : null}

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
                {this.renderPopup(theme)}

                {showToday ? (
                    <div
                        className="aess-chips"
                        style={this.oid('oid_wallbox_today') ? { gridTemplateColumns: 'repeat(6, 1fr)' } : undefined}
                    >
                        {this.renderChip(t('today_pv'), formatEnergy(num(this.val('oid_pv_today'))), COLORS.pv)}
                        {this.renderChip(t('today_load'), formatEnergy(num(this.val('oid_load_today'))), COLORS.house)}
                        {this.renderChip(
                            t('today_import'),
                            formatEnergy(num(this.val('oid_import_today'))),
                            COLORS.gridImport,
                        )}
                        {this.renderChip(
                            t('today_feed'),
                            formatEnergy(num(this.val('oid_feed_today'))),
                            COLORS.gridExport,
                        )}
                        {this.oid('oid_wallbox_today')
                            ? this.renderChip(
                                  t('today_wallbox'),
                                  formatEnergy(num(this.val('oid_wallbox_today'))),
                                  COLORS.wallbox,
                              )
                            : null}
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
