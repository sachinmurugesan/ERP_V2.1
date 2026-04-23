// AB_SPARES ERP — Dashboard V1: Executive Overview (airy, modern)

const DashboardV1 = () => {
  const revSeries = [[220, 310, 280, 360, 420, 380, 490, 520, 480, 560, 610, 680]];
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar active="dashboard"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        <Topbar
          breadcrumbs={['AB_SPARES', 'Workspace']}
          title="Good morning, Ravi"
          subtitle="Here's what's moving today · Tue, 21 Apr"
          right={<button className="btn btn-primary btn-sm"><Icon name="plus" size={14}/> New entry</button>}
        />
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--bg)' }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Revenue (MTD)', value: '₹ 48.2L', delta: '+12.4%', up: true, spark: [2,3,2.5,4,3.5,5,6,5.5,7,8], color: 'var(--brand-600)' },
              { label: 'Open invoices',  value: '₹ 12.8L', delta: '-3.1%', up: false, spark: [5,4,5,3,4,3,2.5,3,2,2], color: 'var(--warn)' },
              { label: 'Inventory value', value: '₹ 84.5L', delta: '+2.8%', up: true, spark: [3,3.2,3.5,3.4,3.6,3.8,4,4.2,4.4,4.6], color: 'var(--info)' },
              { label: 'Gross margin',   value: '34.6%',   delta: '+1.2pt', up: true, spark: [30,31,30.5,32,32.5,33,33.8,34,34.4,34.6], color: 'var(--c4)' },
            ].map((k, i) => (
              <div key={i} className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="kpi-label">{k.label}</div>
                  <Icon name="moreV" size={14} color="var(--fg-subtle)"/>
                </div>
                <div className="kpi-value">{k.value}</div>
                <div className="kpi-sub">
                  <span className={k.up ? 'kpi-delta-up' : 'kpi-delta-down'}>
                    <Icon name={k.up ? 'arrowUp' : 'arrowDown'} size={10} stroke={2.5}/> {k.delta}
                  </span>
                  <span style={{ color: 'var(--fg-muted)' }}>vs last month</span>
                  <div style={{ marginLeft: 'auto' }}><SparkLine data={k.spark} width={72} height={28} color={k.color}/></div>
                </div>
              </div>
            ))}
          </div>

          {/* Main chart + side */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Revenue trend</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Last 12 months · INR lakh</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['1M','3M','6M','1Y','All'].map((t, i) => (
                    <button key={t} className={`btn btn-sm ${i === 3 ? 'btn-secondary' : 'btn-ghost'}`} style={{ height: 26 }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Total</div>
                  <div className="num" style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>₹ 52.30L</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 2 }}>Avg / month</div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-muted)' }}>₹ 4.36L</div>
                </div>
                <span className="chip chip-ok" style={{ marginLeft: 'auto' }}><Icon name="arrowUp" size={10} stroke={2.5}/> +18.2% YoY</span>
              </div>
              <AreaChart series={revSeries} labels={labels} width={620} height={210} colors={['var(--brand-600)']}/>
            </div>

            <div className="card card-pad">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Cash position</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 16 }}>Across 4 accounts · multi-currency</div>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
                <Donut data={[
                  { value: 4820, color: 'var(--brand-600)' },
                  { value: 2180, color: 'var(--info)' },
                  { value: 860, color: 'var(--c3)' },
                  { value: 340, color: 'var(--c4)' },
                ]} size={160} stroke={22} cap="₹ 82L"/>
              </div>
              {[
                { l: 'HDFC · Current', v: '₹ 48.2L', c: 'var(--brand-600)' },
                { l: 'Citi · USD',     v: '$ 26.1k', c: 'var(--info)' },
                { l: 'Emirates NBD · AED', v: 'د.إ 32k', c: 'var(--c3)' },
                { l: 'Petty cash',     v: '₹ 0.8L', c: 'var(--c4)' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.c }}/>
                  <span style={{ fontSize: 12, flex: 1 }}>{r.l}</span>
                  <span className="num" style={{ fontSize: 12, fontWeight: 600 }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row: approvals + recent activity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Pending approvals</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Your review · 7 items</div>
                </div>
                <button className="btn btn-ghost btn-sm">View all <Icon name="arrowRight" size={12}/></button>
              </div>
              {[
                { t: 'Purchase order #PO-2486', who: 'Anita Desai', amt: '₹ 2,84,500', age: '2h', tag: 'procurement', urgent: true },
                { t: 'Vendor invoice · Sundaram Ltd', who: 'Accounting bot', amt: '₹ 1,12,000', age: '4h', tag: 'finance' },
                { t: 'Credit note · INV-8821',  who: 'Sneha Rao',   amt: '₹ 42,300', age: '1d', tag: 'sales' },
                { t: 'Stock adjustment · WH-B', who: 'Vikram K.',   amt: '—',        age: '1d', tag: 'inventory' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>
                    <Icon name={r.tag} size={15}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{r.t}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{r.who} · {r.age} ago</div>
                  </div>
                  <span className="num" style={{ fontSize: 13, fontWeight: 600 }}>{r.amt}</span>
                  {r.urgent && <span className="chip chip-warn">Urgent</span>}
                  <button className="btn btn-sm btn-primary" style={{ height: 26 }}>Review</button>
                </div>
              ))}
            </div>

            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Top-moving SKUs</div>
                <span className="chip chip-accent">Last 30d</span>
              </div>
              {[
                { sku: 'AB-BRK-042', name: 'Brake pad · Hyundai i20',  sold: 482, rev: '₹ 2.8L', t: [3,4,5,4,6,7,8,9,10] },
                { sku: 'AB-OIL-118', name: 'Engine oil 5W-30 · 4L',     sold: 318, rev: '₹ 1.9L', t: [5,5,6,5,6,7,7,8,8] },
                { sku: 'AB-BAT-201', name: 'Battery 65Ah · Exide',      sold: 124, rev: '₹ 1.4L', t: [2,3,2,3,4,4,5,5,6] },
                { sku: 'AB-TYR-309', name: 'Tyre 185/65 R15 · MRF',     sold:  88, rev: '₹ 1.0L', t: [4,4,3,4,4,5,4,5,5] },
              ].map((r, i) => (
                <div key={r.sku} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>{r.sku} · {r.sold} units</div>
                  </div>
                  <SparkLine data={r.t} width={56} height={24} fill={false} color="var(--brand-500)"/>
                  <span className="num" style={{ fontSize: 13, fontWeight: 600, width: 60, textAlign: 'right' }}>{r.rev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { DashboardV1 });
