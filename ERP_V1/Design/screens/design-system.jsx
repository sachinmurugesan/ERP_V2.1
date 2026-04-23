// AB_SPARES ERP — Design system reference card

const DesignSystem = () => (
  <div className="erp-root" style={{ width: '100%', height: '100%', padding: 28, overflow: 'auto', background: 'var(--bg)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
      <Logo size={36}/>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>AB_SPARES · Design System</div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Tokens, type, and primitives — apply across every ERP module</div>
      </div>
    </div>

    {/* Colors */}
    <div style={{ marginTop: 28 }}>
      <div className="label" style={{ marginBottom: 10 }}>Brand · Emerald</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 6 }}>
        {[50,100,200,300,400,500,600,700,800,900,950].map(s => (
          <div key={s}>
            <div style={{ background: `var(--brand-${s})`, height: 56, borderRadius: 8, border: '1px solid var(--border)' }}/>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      <div className="label" style={{ marginBottom: 10, marginTop: 20 }}>Neutrals</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 }}>
        {['0','25','50','100','200','300','400','500','600','700','800','900'].map(s => (
          <div key={s}>
            <div style={{ background: `var(--n-${s})`, height: 48, borderRadius: 8, border: '1px solid var(--border)' }}/>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>

      <div className="label" style={{ marginBottom: 10, marginTop: 20 }}>Semantic</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { n: 'Success', v: 'var(--ok)' },
          { n: 'Warning', v: 'var(--warn)' },
          { n: 'Error',   v: 'var(--err)' },
          { n: 'Info',    v: 'var(--info)' },
        ].map(c => (
          <div key={c.n} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ background: c.v, width: 40, height: 40, borderRadius: 8 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.n}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{c.v}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Typography */}
    <div style={{ marginTop: 28 }}>
      <div className="label" style={{ marginBottom: 10 }}>Type · Manrope + JetBrains Mono</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elev)' }}>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }}>Display · 40/800</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6 }}>Page title · 28/700</div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Section · 20/700</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Card title · 14/600</div>
        <div style={{ fontSize: 13 }}>Body — default 13 for tables, forms, labels</div>
        <div className="mono" style={{ fontSize: 12 }}>Mono · 12 · SKU-AB-BRK-042 · ₹ 1,12,400</div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.6 }}>Label · 11 · overline</div>
      </div>
    </div>

    {/* Components */}
    <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div className="label" style={{ marginBottom: 10 }}>Buttons</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elev)' }}>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-accent">Accent</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-ghost">Ghost</button>
          <button className="btn btn-danger">Danger</button>
          <button className="btn btn-primary btn-sm">Small</button>
          <button className="btn btn-primary btn-lg">Large</button>
        </div>

        <div className="label" style={{ marginBottom: 10, marginTop: 16 }}>Chips</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elev)' }}>
          <span className="chip">Default</span>
          <span className="chip chip-accent">Accent</span>
          <span className="chip chip-ok chip-dot">Success</span>
          <span className="chip chip-warn chip-dot">Warning</span>
          <span className="chip chip-err chip-dot">Error</span>
          <span className="chip chip-info chip-dot">Info</span>
        </div>

        <div className="label" style={{ marginBottom: 10, marginTop: 16 }}>Avatars</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elev)' }}>
          <Av name="Ravi Shah" size="lg"/>
          <Av name="Anita Desai"/>
          <Av name="Sneha Rao" size="sm"/>
          <div className="av-stack">
            <Av name="Ravi Shah"/>
            <Av name="Anita Desai"/>
            <Av name="Sneha Rao"/>
            <Av name="Vikram K."/>
          </div>
        </div>
      </div>

      <div>
        <div className="label" style={{ marginBottom: 10 }}>Inputs</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elev)' }}>
          <input className="input" placeholder="Search orders, invoices, SKUs"/>
          <input className="input" value="SO-9482" readOnly/>
          <input className="input" disabled placeholder="Disabled"/>
        </div>

        <div className="label" style={{ marginBottom: 10, marginTop: 16 }}>Progress</div>
        <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elev)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Progress value={30} color="var(--brand-500)"/>
          <Progress value={62} color="var(--warn)"/>
          <Progress value={88} color="var(--err)"/>
        </div>

        <div className="label" style={{ marginBottom: 10, marginTop: 16 }}>Radius & shadow</div>
        <div style={{ display: 'flex', gap: 10, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-elev)' }}>
          {[['xs','var(--sh-xs)'],['sm','var(--sh-sm)'],['md','var(--sh-md)'],['lg','var(--sh-lg)']].map(([n, s]) => (
            <div key={n} style={{ flex: 1, height: 56, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: s, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--fg-muted)' }}>{n}</div>
          ))}
        </div>
      </div>
    </div>

    {/* Rules */}
    <div style={{ marginTop: 28 }}>
      <div className="label" style={{ marginBottom: 10 }}>Design rules</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          ['Numbers get tabular', 'All monetary, SKU, and metric values use tabular-nums so columns align cleanly.'],
          ['Currency is explicit', 'Every amount shows its symbol; never strip it. Multi-currency rows keep native sym + USD equivalent.'],
          ['Status is semantic', 'Don\'t color amounts by brand — color by meaning (ok/warn/err). Brand green is reserved for primary actions.'],
          ['Density scales with role', 'Exec views breathe; operational dashboards pack 6+ KPIs per row. Tables are 13px with 12px padding.'],
          ['Approvals are workflows', 'Every money-out action passes through a named stepper. Never a lone "Approve" button without context.'],
          ['Role-based scoping', 'Each user only sees data their role permits. Chrome stays the same; content is scoped server-side.'],
        ].map(([t, d], i) => (
          <div key={i} className="card card-pad-sm">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { DesignSystem });
