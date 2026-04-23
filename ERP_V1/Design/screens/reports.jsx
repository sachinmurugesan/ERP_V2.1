// AB_SPARES ERP — Reports & analytics

const ReportsScreen = () => {
  const monthly = [[180, 220, 260, 230, 310, 340, 380, 360, 410, 450, 490, 520]];
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (
    <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar active="reports"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        <Topbar
          breadcrumbs={['Reports', 'Custom']}
          title="Sales performance"
          subtitle="FY 2025-26 · All regions"
          right={<>
            <button className="btn btn-secondary btn-sm"><Icon name="calendar" size={13}/> FY 25-26</button>
            <button className="btn btn-secondary btn-sm"><Icon name="download" size={13}/> Export</button>
          </>}
        />
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { l: 'Net sales', v: '₹ 5.24 Cr', d: '+18.2% YoY' },
              { l: 'Units sold', v: '28,412', d: '+11.4%' },
              { l: 'Avg order', v: '₹ 8,420', d: '+4.8%' },
              { l: 'Margin', v: '34.6%', d: '+1.2 pt' },
            ].map((k, i) => (
              <div key={i} className="card card-pad">
                <div className="kpi-label">{k.l}</div>
                <div className="kpi-value">{k.v}</div>
                <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 4, fontWeight: 600 }}>▲ {k.d}</div>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Monthly net sales</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['Month','Quarter','Year'].map((t, i) => (
                  <button key={t} className={`btn btn-sm ${i === 0 ? 'btn-secondary' : 'btn-ghost'}`} style={{ height: 26 }}>{t}</button>
                ))}
              </div>
            </div>
            <AreaChart series={monthly} labels={labels} width={880} height={220} colors={['var(--brand-600)']}/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>By category</div>
              <BarChart
                data={[
                  { label: 'Brakes', values: [186] },
                  { label: 'Tyres', values: [142] },
                  { label: 'Lubricants', values: [98] },
                  { label: 'Electrical', values: [62] },
                  { label: 'Filters', values: [36] },
                ]}
                width={400} height={180} colors={['var(--brand-500)']}/>
            </div>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>By region</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <Donut
                  data={[
                    { value: 48, color: 'var(--brand-600)' },
                    { value: 22, color: 'var(--info)' },
                    { value: 16, color: 'var(--c3)' },
                    { value: 14, color: 'var(--c4)' },
                  ]}
                  size={150} stroke={20} cap="₹5.2Cr"/>
                <div style={{ flex: 1 }}>
                  {[
                    { l: 'India · West',  v: '₹ 2.5Cr', p: '48%', c: 'var(--brand-600)' },
                    { l: 'India · South', v: '₹ 1.1Cr', p: '22%', c: 'var(--info)' },
                    { l: 'UAE',           v: '₹ 84L',   p: '16%', c: 'var(--c3)' },
                    { l: 'Singapore',     v: '₹ 72L',   p: '14%', c: 'var(--c4)' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: r.c }}/>
                      <span style={{ flex: 1 }}>{r.l}</span>
                      <span className="num" style={{ fontWeight: 600 }}>{r.v}</span>
                      <span className="num" style={{ color: 'var(--fg-muted)', width: 36, textAlign: 'right' }}>{r.p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ReportsScreen });
