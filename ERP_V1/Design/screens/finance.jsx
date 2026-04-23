// AB_SPARES ERP — Finance (AR/AP + invoice detail)

const FinanceScreen = () => (
  <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
    <Sidebar active="finance"/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
      <Topbar
        breadcrumbs={['Finance', 'Receivables']}
        title="Finance · AR / AP"
        subtitle="FY 2025-26 · Q4"
        right={<>
          <button className="btn btn-secondary btn-sm"><Icon name="filter" size={13}/> Filter</button>
          <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> New invoice</button>
        </>}
      />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
        {/* summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { l: 'Receivables', v: '₹ 18.4L', d: '184 invoices', c: 'var(--brand-600)' },
            { l: 'Payables', v: '₹ 9.2L', d: '56 bills', c: 'var(--info)' },
            { l: 'Overdue > 30d', v: '₹ 1.8L', d: '9 invoices', c: 'var(--err)' },
            { l: 'This week collect', v: '₹ 4.6L', d: '32 due', c: 'var(--warn)' },
          ].map((k, i) => (
            <div key={i} className="card card-pad">
              <div className="kpi-label">{k.l}</div>
              <div className="kpi-value" style={{ color: k.c }}>{k.v}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>{k.d}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
          {/* Invoice table */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Open invoices</div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                {['All','Draft','Sent','Partial','Overdue'].map((t, i) => (
                  <button key={t} className={`btn btn-sm ${i === 0 ? 'btn-secondary' : 'btn-ghost'}`} style={{ height: 26 }}>{t}</button>
                ))}
              </div>
            </div>
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Due</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {[
                  { id: 'INV-8821', c: 'Desai Autoworks', iss: '04 Apr', due: '19 Apr', a: '₹ 1,12,400', s: 'Overdue', t: 'err' },
                  { id: 'INV-8820', c: 'Zippy Garage',    iss: '06 Apr', due: '21 Apr', a: '₹ 48,200',   s: 'Due today', t: 'warn' },
                  { id: 'INV-8819', c: 'MRF Partners · Dubai', iss: '10 Apr', due: '25 Apr', a: 'د.إ 1,240', s: 'Sent', t: 'info' },
                  { id: 'INV-8818', c: 'Swift Wheels LLP',iss: '12 Apr', due: '27 Apr', a: '₹ 32,850',   s: 'Partial', t: 'warn' },
                  { id: 'INV-8817', c: 'Nitro Racing',    iss: '14 Apr', due: '29 Apr', a: '₹ 61,300',   s: 'Sent', t: 'info' },
                  { id: 'INV-8816', c: 'Galaxy Motors · SG', iss: '16 Apr', due: '01 May', a: 'S$ 640', s: 'Sent', t: 'info' },
                  { id: 'INV-8815', c: 'Karthik & Sons',  iss: '17 Apr', due: '02 May', a: '₹ 18,650',   s: 'Draft', t: '' },
                ].map(r => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.id}</td>
                    <td>{r.c}</td>
                    <td style={{ color: 'var(--fg-muted)' }}>{r.iss}</td>
                    <td>{r.due}</td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{r.a}</td>
                    <td><span className={`chip chip-dot chip-${r.t || ''}`}>{r.s}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invoice detail panel */}
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Invoice</div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>INV-8821</div>
              </div>
              <span className="chip chip-err" style={{ marginLeft: 'auto' }}>Overdue 2d</span>
            </div>

            <div style={{ display: 'flex', gap: 16, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div className="label">Bill to</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Desai Autoworks</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Andheri W, Mumbai</div>
              </div>
              <div>
                <div className="label">Currency</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>INR ₹</div>
              </div>
            </div>

            {[
              { d: 'Brake pads · Hyundai i20', q: 80, p: 850, t: '₹ 68,000' },
              { d: 'Engine oil 5W-30 · 4L',    q: 24, p: 1200, t: '₹ 28,800' },
              { d: 'Battery 65Ah · Exide',     q:  4, p: 3900, t: '₹ 15,600' },
            ].map((l, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{l.d}</div>
                  <div className="num" style={{ color: 'var(--fg-muted)', fontSize: 11 }}>{l.q} × ₹{l.p}</div>
                </div>
                <div className="num" style={{ fontWeight: 600 }}>{l.t}</div>
              </div>
            ))}

            <div style={{ display: 'flex', fontSize: 12, padding: '8px 0', color: 'var(--fg-muted)' }}>
              <span style={{ flex: 1 }}>Subtotal</span>
              <span className="num">₹ 1,12,400</span>
            </div>
            <div style={{ display: 'flex', fontSize: 12, padding: '8px 0', color: 'var(--fg-muted)' }}>
              <span style={{ flex: 1 }}>GST · 18%</span>
              <span className="num">₹ 20,232</span>
            </div>
            <div style={{ display: 'flex', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ flex: 1, fontWeight: 700 }}>Total due</span>
              <span className="num" style={{ fontWeight: 800, fontSize: 17, letterSpacing: -0.3 }}>₹ 1,32,632</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-accent btn-sm" style={{ flex: 1 }}>Send reminder</button>
              <button className="btn btn-secondary btn-sm">Record payment</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { FinanceScreen });
