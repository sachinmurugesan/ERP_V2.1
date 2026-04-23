// AB_SPARES ERP — Dashboard V2: Operational (dense, data-forward)

const DashboardV2 = () => (
  <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
    <Sidebar active="dashboard" compact/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
      <Topbar
        breadcrumbs={['AB_SPARES', 'Operations', 'Live']}
        title="Operations control"
        subtitle="Live · refreshed 14s ago"
        right={<>
          <button className="btn btn-ghost btn-sm"><Icon name="refresh" size={13}/></button>
          <button className="btn btn-secondary btn-sm"><Icon name="download" size={13}/> Export</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> Entry</button>
        </>}
      />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-sunken)' }}>
        {/* Hero strip — 6 compact metrics */}
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', overflow: 'hidden' }}>
          {[
            { l: 'Orders today', v: '286', d: '+14', c: 'var(--brand-600)' },
            { l: 'Pending fulfil', v: '42', d: '-6', c: 'var(--warn)' },
            { l: 'In transit', v: '18', d: '+2', c: 'var(--info)' },
            { l: 'Overdue invoices', v: '9', d: '+1', c: 'var(--err)' },
            { l: 'Low stock SKUs', v: '23', d: '-4', c: 'var(--warn)' },
            { l: 'Returns', v: '6', d: '0', c: 'var(--fg-muted)' },
          ].map((k, i) => (
            <div key={i} style={{ padding: '16px 18px', borderRight: i < 5 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--fg-muted)' }}>{k.l}</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginTop: 6, color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--fg-muted)', marginTop: 2 }}>{k.d} vs yday</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
          {/* Live order feed table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Live orders</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Auto-updating</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                {['All','New','Packing','Shipped','Held'].map((t, i) => (
                  <button key={t} className={`btn btn-sm ${i === 0 ? 'btn-secondary' : 'btn-ghost'}`} style={{ height: 26 }}>{t}</button>
                ))}
              </div>
            </div>
            <table className="tbl">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Value</th><th>Stage</th><th>ETA</th></tr></thead>
              <tbody>
                {[
                  { o: 'SO-9482', c: 'Zippy Garage', i: 14, v: '₹ 48,200', s: 'Packing',  eta: 'Today', cur: 'INR', stage: 'warn' },
                  { o: 'SO-9481', c: 'MRF Partners · Dubai', i: 3, v: 'د.إ 1,240', s: 'Shipped', eta: '23 Apr', cur: 'AED', stage: 'info' },
                  { o: 'SO-9480', c: 'Desai Autoworks', i: 28, v: '₹ 1,12,400', s: 'New', eta: 'Today', cur: 'INR', stage: 'ok' },
                  { o: 'SO-9479', c: 'Swift Wheels LLP', i: 9, v: '₹ 32,850', s: 'Held', eta: 'TBD', cur: 'INR', stage: 'err' },
                  { o: 'SO-9478', c: 'Galaxy Motors · SG', i: 6, v: 'S$ 640', s: 'Shipped', eta: '26 Apr', cur: 'SGD', stage: 'info' },
                  { o: 'SO-9477', c: 'Nitro Racing', i: 12, v: '₹ 61,300', s: 'Packing',  eta: 'Today', cur: 'INR', stage: 'warn' },
                  { o: 'SO-9476', c: 'Karthik & Sons',  i: 4, v: '₹ 18,650', s: 'New', eta: 'Today', cur: 'INR', stage: 'ok' },
                ].map((r) => (
                  <tr key={r.o}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.o}</td>
                    <td style={{ fontWeight: 500 }}>{r.c}</td>
                    <td className="num" style={{ color: 'var(--fg-muted)' }}>{r.i}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.v}</td>
                    <td><span className={`chip chip-dot chip-${r.stage}`}>{r.s}</span></td>
                    <td style={{ color: 'var(--fg-muted)' }}>{r.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Warehouse strip + AR aging */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Warehouse capacity</div>
                <span className="chip">3 locations</span>
              </div>
              {[
                { n: 'Mumbai · WH-A', fill: 78, sku: 1240, c: 'var(--warn)' },
                { n: 'Pune · WH-B',   fill: 54, sku: 860, c: 'var(--brand-500)' },
                { n: 'Dubai · WH-C',  fill: 91, sku: 420, c: 'var(--err)' },
              ].map(w => (
                <div key={w.n} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{w.n}</span>
                    <span className="num" style={{ color: 'var(--fg-muted)' }}>{w.sku} SKU · {w.fill}%</span>
                  </div>
                  <Progress value={w.fill} color={w.c} height={6}/>
                </div>
              ))}
            </div>

            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>AR aging</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 12 }}>Outstanding · ₹ 18.4L</div>
              <BarChart
                data={[
                  { label: 'Current', values: [820] },
                  { label: '1–30',    values: [560] },
                  { label: '31–60',   values: [280] },
                  { label: '61–90',   values: [140] },
                  { label: '90+',     values: [40]  },
                ]}
                width={340} height={120}
                colors={['var(--brand-500)']}
              />
            </div>
          </div>
        </div>

        {/* Approval queue + currency */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Approval queue</div>
              <span className="chip chip-warn">7 waiting</span>
            </div>
            {[
              { t: 'PO-2486 · Sundaram spares',   a: '₹ 2,84,500', u: 'Anita D.', step: '2/3' },
              { t: 'INV-8821 · Credit note', a: '₹ 42,300', u: 'Sneha R.', step: '1/2' },
              { t: 'Vendor bill · Exide batteries', a: '₹ 1,12,000', u: 'Ravi S.', step: '3/3' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.t}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>Requested · {r.u} · step {r.step}</div>
                </div>
                <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{r.a}</span>
                <button className="btn btn-sm btn-secondary" style={{ height: 26 }}><Icon name="close" size={12}/></button>
                <button className="btn btn-sm btn-accent" style={{ height: 26 }}><Icon name="check" size={12}/></button>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Currency exposure</div>
              <span className="chip">Today's rate</span>
            </div>
            {[
              { code: 'INR', sym: '₹', bal: '48,20,000', rate: '1.00', usd: '$ 57.8k', d: '' },
              { code: 'USD', sym: '$', bal: '26,140',    rate: '83.42', usd: '$ 26.1k', d: '+0.3%' },
              { code: 'AED', sym: 'د.إ', bal: '32,050', rate: '22.72', usd: '$ 8.7k',  d: '-0.1%' },
              { code: 'SGD', sym: 'S$', bal: '4,820',    rate: '61.45', usd: '$ 3.5k',  d: '+0.4%' },
            ].map((r, i) => (
              <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 1fr', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <span className="chip chip-accent" style={{ justifyContent: 'center' }}>{r.code}</span>
                <span className="num" style={{ fontSize: 12, fontWeight: 600 }}>{r.sym} {r.bal}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>@ {r.rate}</span>
                <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  <span className="num" style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-muted)' }}>{r.usd}</span>
                  {r.d && <span className="num" style={{ fontSize: 10.5, color: r.d.startsWith('+') ? 'var(--ok)' : 'var(--err)' }}>{r.d}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { DashboardV2 });
