// AB_SPARES ERP — App shell: Sidebar + Topbar
// Reused across all module screens.

const NAV = [
  { group: '', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  ]},
  { group: 'Operations', items: [
    { id: 'sales', label: 'Sales & CRM', icon: 'sales', badge: '24' },
    { id: 'inventory', label: 'Inventory', icon: 'inventory' },
    { id: 'procurement', label: 'Procurement', icon: 'procurement', badge: '7' },
  ]},
  { group: 'Finance', items: [
    { id: 'finance', label: 'Finance', icon: 'finance' },
    { id: 'invoices', label: 'Invoices', icon: 'invoice' },
    { id: 'payments', label: 'Payments', icon: 'credit' },
  ]},
  { group: 'Insights', items: [
    { id: 'reports', label: 'Reports', icon: 'reports' },
  ]},
  { group: 'System', items: [
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ]},
];

const Sidebar = ({ active = 'dashboard', compact = false }) => (
  <aside style={{
    width: compact ? 64 : 232, flexShrink: 0, background: 'var(--bg-elev)',
    borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
    padding: compact ? '16px 8px' : '16px 14px', gap: 4,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px 16px' }}>
      <Logo size={26}/>
      {!compact && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>AB_SPARES</div>
          <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Workspace</div>
        </div>
      )}
    </div>

    {!compact && (
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--fg-subtle)' }}><Icon name="search" size={14}/></span>
        <input className="input" placeholder="Search or ⌘K" style={{ paddingLeft: 30, height: 32, fontSize: 12, background: 'var(--bg-sunken)' }}/>
      </div>
    )}

    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV.map((g, gi) => (
        <div key={gi} style={{ marginTop: g.group ? 14 : 0 }}>
          {g.group && !compact && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)', letterSpacing: 1, textTransform: 'uppercase', padding: '4px 10px 6px' }}>{g.group}</div>
          )}
          {g.items.map(it => (
            <div key={it.id} className={`nav-item ${it.id === active ? 'active' : ''}`} style={compact ? { justifyContent: 'center', padding: 0, width: 40, height: 40 } : {}}>
              <Icon name={it.icon} size={16}/>
              {!compact && <><span>{it.label}</span>
              {it.badge && <span className="chip" style={{ height: 18, padding: '0 6px', fontSize: 10, marginLeft: 'auto' }}>{it.badge}</span>}</>}
            </div>
          ))}
        </div>
      ))}
    </div>

    {!compact && (
      <div style={{ marginTop: 10, padding: 12, background: 'var(--brand-50)', borderRadius: 'var(--r-md)', border: '1px solid var(--brand-100)', position: 'relative', overflow: 'hidden' }}
        className="promo-card">
        <style>{`.theme-dark .promo-card { background: color-mix(in oklch, var(--brand-500) 10%, transparent) !important; border-color: color-mix(in oklch, var(--brand-500) 22%, transparent) !important; }`}</style>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-800)', marginBottom: 4 }}>Close books faster</div>
        <div style={{ fontSize: 11, color: 'var(--brand-700)', lineHeight: 1.4, marginBottom: 8 }}>Auto-reconcile ledgers with AI matching.</div>
        <button className="btn btn-sm btn-primary" style={{ height: 26, width: '100%' }}>Try AutoReconcile</button>
      </div>
    )}

    <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <Av name="Ravi Shah" size="md"/>
      {!compact && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Ravi Shah</div>
          <div style={{ fontSize: 10, color: 'var(--fg-muted)' }}>Finance Admin · Mumbai</div>
        </div>
      )}
      {!compact && <Icon name="chevronD" size={14} color="var(--fg-muted)"/>}
    </div>
  </aside>
);

const Topbar = ({ title, subtitle, breadcrumbs, right, onToggleTheme, theme }) => (
  <header style={{
    display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
    borderBottom: '1px solid var(--border)', background: 'var(--bg-elev)',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      {breadcrumbs && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, fontWeight: 500 }}>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              <span>{b}</span>
              {i < breadcrumbs.length - 1 && <Icon name="chevronR" size={10}/>}
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{title}</h1>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{subtitle}</span>}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button className="btn btn-secondary btn-sm" title="Currency">
        <Icon name="globe" size={13}/> INR ₹
      </button>
      <button className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }} onClick={onToggleTheme} title="Toggle theme">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14}/>
      </button>
      <button className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0, position: 'relative' }}>
        <Icon name="bell" size={14}/>
        <span style={{ position: 'absolute', top: 6, right: 7, width: 7, height: 7, borderRadius: '50%', background: 'var(--err)', border: '1.5px solid var(--bg-elev)' }}/>
      </button>
      {right}
    </div>
  </header>
);

Object.assign(window, { Sidebar, Topbar });
