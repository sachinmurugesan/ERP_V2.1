// AB_SPARES ERP — Procurement (PO detail + approval workflow)

const ProcurementScreen = () => (
  <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
    <Sidebar active="procurement"/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
      <Topbar
        breadcrumbs={['Procurement', 'PO-2486']}
        title="Purchase order · PO-2486"
        subtitle="Draft · awaiting your approval"
        right={<>
          <button className="btn btn-secondary btn-sm"><Icon name="download" size={13}/> PDF</button>
          <button className="btn btn-ghost btn-sm">Reject</button>
          <button className="btn btn-accent btn-sm"><Icon name="check" size={13}/> Approve</button>
        </>}
      />
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, background: 'var(--bg)' }}>
        {/* PO detail */}
        <div className="card card-pad">
          <div style={{ display: 'flex', gap: 24, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div className="label">Vendor</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Sundaram Industries Ltd</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>Chennai · Vendor since 2019 · ★ 4.8</div>
            </div>
            <div>
              <div className="label">Currency</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>INR ₹</div>
            </div>
            <div>
              <div className="label">Delivery</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>28 Apr 2026</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>WH-A Mumbai</div>
            </div>
            <div>
              <div className="label">Terms</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>Net 30</div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Line items</div>
          <table className="tbl" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead><tr><th>SKU</th><th>Description</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {[
                { s: 'AB-BRK-042', d: 'Brake pad · Hyundai i20',  q: 840, u: '₹ 282', t: '₹ 2,36,880' },
                { s: 'AB-BRK-051', d: 'Brake disc · Swift',       q: 120, u: '₹ 420', t: '₹ 50,400' },
                { s: 'AB-BRK-066', d: 'Brake fluid DOT-4 · 1L',   q: 240, u: '₹ 180', t: '₹ 43,200' },
              ].map(r => (
                <tr key={r.s}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.s}</td>
                  <td>{r.d}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{r.q}</td>
                  <td className="num" style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{r.u}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{r.t}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <div style={{ width: 260 }}>
              {[
                ['Subtotal', '₹ 3,30,480'],
                ['GST · 18%', '₹ 59,486'],
                ['Freight', '₹ 4,800'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', fontSize: 12, padding: '6px 0', color: 'var(--fg-muted)' }}>
                  <span style={{ flex: 1 }}>{l}</span>
                  <span className="num">{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontWeight: 700 }}>Total</span>
                <span className="num" style={{ fontWeight: 800, fontSize: 17 }}>₹ 3,94,766</span>
              </div>
            </div>
          </div>
        </div>

        {/* Approval workflow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Approval workflow</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 16 }}>Step 2 of 3 · You</div>
            {[
              { s: 'Requested', who: 'Anita Desai · Procurement', when: '21 Apr · 09:14', done: true },
              { s: 'Finance review', who: 'Ravi Shah · You', when: 'Pending', active: true },
              { s: 'Director approval', who: 'Bhavna Rao · Director', when: 'Waiting', done: false },
            ].map((st, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < arr.length - 1 ? 18 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: st.done ? 'var(--brand-500)' : st.active ? 'var(--bg-elev)' : 'var(--bg-sunken)',
                    border: st.active ? '2px solid var(--brand-500)' : '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {st.done && <Icon name="check" size={12} color="#fff" stroke={3}/>}
                    {st.active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-500)' }}/>}
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 2, flex: 1, background: st.done ? 'var(--brand-500)' : 'var(--border)', marginTop: 4 }}/>}
                </div>
                <div style={{ flex: 1, paddingBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{st.s}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{st.who}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{st.when}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Compliance checks</div>
            {[
              { l: 'Budget available (₹ 8L)', ok: true },
              { l: 'Vendor KYC on file', ok: true },
              { l: '3 quotes attached', ok: true },
              { l: 'Over threshold (>₹ 3L)', ok: false },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                <Icon name={c.ok ? 'check' : 'warning'} size={14} color={c.ok ? 'var(--ok)' : 'var(--warn)'}/>
                <span style={{ flex: 1 }}>{c.l}</span>
                <span className={`chip chip-${c.ok ? 'ok' : 'warn'}`}>{c.ok ? 'Pass' : 'Review'}</span>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Notes</div>
            <textarea className="input" placeholder="Leave a note for the next approver…" style={{ height: 72, padding: 10, resize: 'none' }}/>
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { ProcurementScreen });
