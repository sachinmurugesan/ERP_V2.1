// AB_SPARES ERP — Settings (role-based views)

const SettingsScreen = () => (
  <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
    <Sidebar active="settings"/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
      <Topbar
        breadcrumbs={['Settings', 'Roles & permissions']}
        title="Roles & permissions"
        subtitle="Role-based access control · 6 roles · 42 users"
        right={<button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> New role</button>}
      />
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, background: 'var(--bg)' }}>
        {/* Role list */}
        <div className="card" style={{ padding: 8, height: 'fit-content' }}>
          <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Roles</div>
          {[
            { n: 'Owner', u: 2, active: false },
            { n: 'Finance Admin', u: 4, active: true },
            { n: 'Sales Manager', u: 6 },
            { n: 'Procurement', u: 3 },
            { n: 'Warehouse', u: 12 },
            { n: 'Viewer', u: 15 },
          ].map(r => (
            <div key={r.n} className={`nav-item ${r.active ? 'active' : ''}`} style={{ marginBottom: 2 }}>
              <Icon name="shield" size={14}/>
              <span>{r.n}</span>
              <span className="num" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-muted)' }}>{r.u}</span>
            </div>
          ))}
        </div>

        {/* Role detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Finance Admin</h2>
                  <span className="chip chip-accent">Elevated</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4 }}>Full access to AR/AP, ledger, reconciliation. Cannot change org-level settings.</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm">Duplicate</button>
                <button className="btn btn-secondary btn-sm">Edit</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div className="label" style={{ marginBottom: 10 }}>Module access</div>
                {[
                  { m: 'Dashboard', lvl: 'Full' },
                  { m: 'Finance · AR/AP',  lvl: 'Full' },
                  { m: 'Invoices & payments', lvl: 'Full' },
                  { m: 'Sales & CRM',      lvl: 'View' },
                  { m: 'Inventory',        lvl: 'View' },
                  { m: 'Procurement',      lvl: 'Approve' },
                  { m: 'Reports',          lvl: 'Full' },
                  { m: 'Settings',         lvl: 'None' },
                ].map((p, i) => (
                  <div key={p.m} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{p.m}</span>
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-sunken)', padding: 2, borderRadius: 6 }}>
                      {['None','View','Approve','Full'].map(l => (
                        <span key={l} style={{
                          fontSize: 10.5, fontWeight: 600, padding: '4px 8px', borderRadius: 4,
                          background: p.lvl === l ? 'var(--bg-elev)' : 'transparent',
                          color: p.lvl === l ? 'var(--brand-700)' : 'var(--fg-muted)',
                          boxShadow: p.lvl === l ? 'var(--sh-xs)' : 'none',
                        }}>{l}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div className="label" style={{ marginBottom: 10 }}>Approval authority</div>
                {[
                  { l: 'Approve POs',     v: 'Up to ₹ 5L' },
                  { l: 'Approve expenses', v: 'Up to ₹ 2L' },
                  { l: 'Write-offs',      v: 'Up to ₹ 50k' },
                  { l: 'Currency ops',    v: 'All currencies' },
                ].map((r, i) => (
                  <div key={r.l} style={{ display: 'flex', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{r.l}</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{r.v}</span>
                  </div>
                ))}

                <div className="label" style={{ marginBottom: 10, marginTop: 20 }}>Data scope</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['All regions','All currencies','All warehouses','PII access'].map(t => (
                    <span key={t} className="chip chip-ok">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Members</div>
              <span className="chip" style={{ marginLeft: 8 }}>4</span>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}><Icon name="plus" size={12}/> Invite</button>
            </div>
            {[
              { n: 'Ravi Shah', e: 'ravi@ab-spares.com', since: 'Jan 2022' },
              { n: 'Priya Menon', e: 'priya@ab-spares.com', since: 'Mar 2023' },
              { n: 'Arun Kapoor', e: 'arun@ab-spares.com', since: 'Aug 2024' },
              { n: 'Neha Iyer', e: 'neha@ab-spares.com', since: 'Feb 2026' },
            ].map((u, i) => (
              <div key={u.e} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <Av name={u.n}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{u.n}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{u.e}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Member since {u.since}</span>
                <button className="btn btn-ghost btn-sm" style={{ width: 28, padding: 0 }}><Icon name="moreV" size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { SettingsScreen });
