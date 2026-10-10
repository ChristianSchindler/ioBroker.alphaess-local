// Renders the widget outside of vis-2 with a minimal stand-in for window.visRxWidget
import React from 'react';
import { createRoot } from 'react-dom/client';
import de from '../src/i18n/de.json';

window.visRxWidget = class extends React.Component {
    // Like vis-2: t() resolves the prefix via `this`, so calling it unbound fails here too
    static t(key) {
        const prefix = this.getI18nPrefix();
        return de[key] || `${prefix}${key}`;
    }
    constructor(props) {
        super(props);
        this.state = { rxData: props.data, values: props.values };
    }
    static getDerivedStateFromProps(props) {
        return { rxData: props.data, values: props.values };
    }
    // stand-in for the view vis-2 renders inside a widget
    getWidgetView(view) {
        return <div style={{ padding: 20, font: '15px system-ui' }}>Inhalt der View „{view}“ (z. B. Charts)</div>;
    }
    renderWidgetBody() {}
    render() {
        return this.renderWidgetBody(this.props);
    }
};

const { default: Widget } = await import('../src/AlphaEssPowerFlow.jsx');
Widget.adapter = 'alphaess-local';
const info = Widget.getWidgetInfo();
const defaults = {};
info.visAttrs.forEach(g => g.fields.forEach(f => (defaults[f.name] = f.default)));

// any wallbox: the preview server delivers it under alphaess-local.0.wallbox.*
const wallbox = {
    oid_wallbox: 'alphaess-local.0.wallbox.power',
    oid_wallbox_status: 'alphaess-local.0.wallbox.plugged',
    oid_wallbox_soc: 'alphaess-local.0.wallbox.soc',
    wallbox_unit: 'kW',
    oid_wallbox_today: 'alphaess-local.0.wallbox.today',
};
const views = { view_pv: 'Solar', view_grid: 'Netz', view_house: 'Haus', view_battery: 'Batterie', view_wallbox: 'Wallbox', popup_battery: true };

function App() {
    const [values, setValues] = React.useState({});
    const [view, setView] = React.useState('');
    const context = { changeView: v => setView(v) };
    React.useEffect(() => {
        const load = () =>
            fetch('http://localhost:8899')
                .then(r => r.json())
                .then(({ values: v }) => {
                    const out = {};
                    Object.entries(v).forEach(([id, val]) => (out[`alphaess-local.0.${id}.val`] = val));
                    setValues(out);
                })
                .catch(() => {});
        load();
        const t = setInterval(load, 1000);
        return () => clearInterval(t);
    }, []);
    return (
        <>
            <div id="nav" style={{ width: '100%', font: '600 16px system-ui' }}>Navigation: {view || '–'}</div>
            <div className="frame"><Widget data={{ ...defaults, ...views }} values={values} context={context} /></div>
            <div className="frame"><Widget data={{ ...defaults, ...views, ...wallbox }} values={values} context={context} /></div>
        </>
    );
}
createRoot(document.getElementById('root')).render(<App />);
