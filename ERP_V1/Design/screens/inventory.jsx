// AB_SPARES ERP — Inventory & warehouse

const InventoryScreen = () => (
  <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
    <Sidebar active="inventory"/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
      <Topbar
        breadcrumbs={['Inventory', 'All SKUs']}
        title="Inventory"
        subtitle="3,248 SKUs · 3 warehouses"
        right={<>
          <button className="btn btn-secondary btn-sm"><Icon name="upload" size={13}/> Import</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> New SKU</button>
        </>}
      />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { l: 'Total value', v: '₹ 84.5L', d: '+2.8% MoM' },
            { l: 'Low stock', v: '23', d: 'Reorder needed', c: 'var(--warn)' },
            { l: 'Out of stock', v: '4', d: 'Blocking 11 orders', c: 'var(--err)' },
            { l: 'Turnover', v: '6.4x', d: 'Annual' },
          ].map((k, i) => (
            <div key={i} className="card card-pad">
              <div className="kpi-label">{k.l}</div>
              <div className="kpi-value" style={k.c ? { color: k.c } : {}}>{k.v}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>{k.d}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
              <span style={{ position: 'absolute', left: 11, top: 10, color: 'var(--fg-subtle)' }}><Icon name="search" size={14}/></span>
              <input className="input" placeholder="Search SKU, name, category" style={{ paddingLeft: 32, height: 32 }}/>
            </div>
            <button className="btn btn-ghost btn-sm"><Icon name="filter" size={13}/> Category</button>
            <button className="btn btn-ghost btn-sm"><Icon name="filter" size={13}/> Warehouse</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" style={{ height: 28 }}>All 3,248</button>
              <button className="btn btn-ghost btn-sm" style={{ height: 28 }}>Low 23</button>
              <button className="btn btn-ghost btn-sm" style={{ height: 28 }}>Out 4</button>
            </div>
          </div>
          <table className="tbl">
            <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th style={{ textAlign: 'right' }}>On hand</th><th style={{ textAlign: 'right' }}>Reserved</th><th style={{ textAlign: 'right' }}>Value</th><th>Health</th></tr></thead>
            <tbody>
              {[
                { s: 'AB-BRK-042', n: 'Brake pad · Hyundai i20', cat: 'Brakes', oh: 84, res: 32, val: '₹ 71,400', h: 11, max: 500, st: 'warn' },
                { s: 'AB-OIL-118', n: 'Engine oil 5W-30 · 4L',    cat: 'Lubricants', oh: 246, res: 18, val: '₹ 2.95L', h: 61, max: 400, st: 'ok' },
                { s: 'AB-BAT-201', n: 'Battery 65Ah · Exide',     cat: 'Electrical', oh: 18, res: 6, val: '₹ 70,200', h: 18, max: 100, st: 'warn' },
                { s: 'AB-TYR-309', n: 'Tyre 185/65 R15 · MRF',    cat: 'Tyres', oh: 0, res: 4, val: '₹ 0', h: 0, max: 80, st: 'err' },
                { s: 'AB-FLT-077', n: 'Air filter · Maruti Swift',cat: 'Filters', oh: 172, res: 24, val: '₹ 34,400', h: 72, max: 240, st: 'ok' },
                { s: 'AB-SPK-412', n: 'Spark plug NGK · 4pk',     cat: 'Ignition', oh: 96, res: 8, val: '₹ 19,200', h: 48, max: 200, st: 'ok' },
                { s: 'AB-BLT-056', n: 'Timing belt · i10',        cat: 'Engine',  oh: 12, res: 2, val: '₹ 8,400', h: 15, max: 80, st: 'warn' },
              ].map(r => (
                <tr key={r.s}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.s}</td>
                  <td style={{ fontWeight: 500 }}>{r.n}</td>
                  <td><span className="chip">{r.cat}</span></td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600, color: r.st === 'err' ? 'var(--err)' : 'inherit' }}>{r.oh}</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{r.res}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 500 }}>{r.val}</td>
                  <td style={{ width: 120 }}><Progress value={r.h} color={r.st === 'ok' ? 'var(--brand-500)' : r.st === 'warn' ? 'var(--warn)' : 'var(--err)'}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { InventoryScreen });
