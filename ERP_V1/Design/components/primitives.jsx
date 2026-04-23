// AB_SPARES ERP — Shared primitives: Icon set, SparkLine, Donut, Bar, AreaChart, LogoMark
// Made with inline SVG — no deps.

const Icon = ({ name, size = 16, stroke = 1.6, color = 'currentColor', style }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  const P = {
    home:      <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/>,
    dashboard: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
    finance:   <><path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    sales:     <><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></>,
    crm:       <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="7" r="2.5"/><path d="M14 13.5a5 5 0 0 1 7 4.5"/></>,
    inventory: <><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></>,
    procurement: <><path d="M3 4h2l2.5 12h12L22 7H7"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></>,
    reports:   <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 14v3M12 10v7M16 7v10"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    search:    <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    bell:      <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    filter:    <path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/>,
    download:  <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    upload:    <><path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/></>,
    chevronR:  <path d="M9 6l6 6-6 6"/>,
    chevronL:  <path d="M15 6l-6 6 6 6"/>,
    chevronD:  <path d="M6 9l6 6 6-6"/>,
    chevronU:  <path d="M6 15l6-6 6 6"/>,
    arrowUp:   <path d="M12 19V5M5 12l7-7 7 7"/>,
    arrowDown: <path d="M12 5v14M5 12l7 7 7-7"/>,
    arrowRight:<path d="M5 12h14M12 5l7 7-7 7"/>,
    check:     <path d="M4 12l5 5L20 6"/>,
    close:     <path d="M6 6l12 12M6 18L18 6"/>,
    more:      <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    moreV:     <><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></>,
    calendar:  <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
    clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    user:      <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>,
    moon:      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
    sun:       <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    expand:    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>,
    box:       <><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></>,
    truck:     <><path d="M1 6h13v10H1z"/><path d="M14 9h5l3 3v4h-8"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/></>,
    invoice:   <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 13h7M9 17h5M9 9h2"/></>,
    credit:    <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
    globe:     <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    shield:    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    tag:       <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/></>,
    warning:   <><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></>,
    flame:     <path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6s3-4 3-4zM9 14a3 3 0 0 0 6 0c0-2-3-3-3-5 0 0-3 1-3 5z"/>,
    star:      <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>,
    sparkle:   <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></>,
    zap:       <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>,
    refresh:   <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
    grid:      <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    list:      <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    help:      <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></>,
  };
  return <svg {...common}>{P[name] || P.home}</svg>;
};

// Logo mark — AB geometric spark
const Logo = ({ size = 28, color = 'var(--brand-800)' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill={color}/>
    <path d="M8 22L13 10h2l5 12h-2.2l-1.1-2.7h-5.4L10.2 22H8zm4.7-4.6h3.9L14.65 12.3h-.1l-1.85 5.1z" fill="#fff"/>
    <circle cx="23" cy="10" r="2" fill="var(--brand-400)"/>
  </svg>
);

// Spark line with gradient area
const SparkLine = ({ data, width = 120, height = 36, color = 'var(--brand-600)', fill = true, strokeWidth = 1.75 }) => {
  const min = Math.min(...data), max = Math.max(...data);
  const r = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / r) * (height - 4) - 2;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${d} L${width},${height} L0,${height} Z`;
  const gid = `sg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`}/>}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// Area chart with x labels
const AreaChart = ({ series, labels, width = 600, height = 200, colors = ['var(--brand-500)', 'var(--info)'], yTicks = 4 }) => {
  const all = series.flatMap(s => s);
  const min = 0;
  const max = Math.max(...all) * 1.1;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const x = (i, n) => pad.l + (i / (n - 1)) * W;
  const y = v => pad.t + H - ((v - min) / (max - min)) * H;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const yy = pad.t + (i / yTicks) * H;
        const val = max - (i / yTicks) * max;
        return (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={yy} y2={yy} stroke="var(--border)" strokeDasharray={i === yTicks ? '' : '2,3'}/>
            <text x={pad.l - 8} y={yy + 3} fontSize="10" fill="var(--fg-subtle)" textAnchor="end" fontFamily="var(--f-mono)">
              {val >= 1000 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* x labels */}
      {labels && labels.map((l, i) => (
        <text key={i} x={x(i, labels.length)} y={height - 6} fontSize="10" fill="var(--fg-subtle)" textAnchor="middle">{l}</text>
      ))}
      {/* series */}
      {series.map((s, si) => {
        const pts = s.map((v, i) => [x(i, s.length), y(v)]);
        const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
        const area = `${d} L${pad.l + W},${pad.t + H} L${pad.l},${pad.t + H} Z`;
        const gid = `ag-${si}-${Math.random().toString(36).slice(2, 6)}`;
        return (
          <g key={si}>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={colors[si]} stopOpacity="0.22"/>
                <stop offset="100%" stopColor={colors[si]} stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`}/>
            <path d={d} fill="none" stroke={colors[si]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        );
      })}
    </svg>
  );
};

// Donut
const Donut = ({ data, size = 140, stroke = 18, cap = '' }) => {
  const total = data.reduce((a, b) => a + b.value, 0);
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg width={size} height={size}>
      <g transform={`translate(${size/2},${size/2}) rotate(-90)`}>
        <circle r={R} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
        {data.map((d, i) => {
          const frac = d.value / total;
          const seg = C * frac;
          const off = -C * (acc / total);
          acc += d.value;
          return (
            <circle key={i} r={R} fill="none" stroke={d.color} strokeWidth={stroke}
              strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={off} strokeLinecap="butt"/>
          );
        })}
      </g>
      <text x={size/2} y={size/2 - 4} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--fg)" fontFamily="var(--f-sans)">{cap || total}</text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle" fontSize="10" fill="var(--fg-muted)">Total</text>
    </svg>
  );
};

// Bar chart — horizontal or vertical groups
const BarChart = ({ data, width = 600, height = 180, colors = ['var(--brand-500)'] }) => {
  // data: [{ label, values: [..] }]
  const all = data.flatMap(d => d.values);
  const max = Math.max(...all) * 1.1;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const groupW = W / data.length;
  const barW = Math.min(18, (groupW - 8) / data[0].values.length);
  return (
    <svg width={width} height={height}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={width - pad.r} y1={pad.t + f * H} y2={pad.t + f * H} stroke="var(--border)" strokeDasharray={f === 1 ? '' : '2,3'}/>
      ))}
      {data.map((g, gi) => (
        <g key={gi} transform={`translate(${pad.l + gi * groupW + (groupW - barW * g.values.length - 4) / 2},0)`}>
          {g.values.map((v, vi) => {
            const h = (v / max) * H;
            return <rect key={vi} x={vi * (barW + 2)} y={pad.t + H - h} width={barW} height={h} rx="3" fill={colors[vi % colors.length]}/>;
          })}
          <text x={(barW * g.values.length) / 2} y={height - 6} fontSize="10" fill="var(--fg-subtle)" textAnchor="middle">{g.label}</text>
        </g>
      ))}
    </svg>
  );
};

// Progress
const Progress = ({ value, max = 100, color = 'var(--brand-500)', height = 6 }) => (
  <div style={{ background: 'var(--border)', borderRadius: 999, height, overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, height: '100%', borderRadius: 999 }}/>
  </div>
);

// Avatar initials helper
const Av = ({ name, color, size = 'md' }) => {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const cls = size === 'sm' ? 'av av-sm' : size === 'lg' ? 'av av-lg' : 'av';
  const bg = color || null;
  return <span className={cls} style={bg ? { background: bg } : {}}>{initials}</span>;
};

Object.assign(window, { Icon, Logo, SparkLine, AreaChart, Donut, BarChart, Progress, Av });
