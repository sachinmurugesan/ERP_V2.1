// AB_SPARES ERP — Dashboard V3: Command Center (bold, dark-first)

const DashboardV3 = () => {
  const ser = [
    [120, 180, 150, 220, 260, 230, 300, 340, 310, 380, 420, 460],
    [80, 100, 110, 130, 150, 140, 170, 190, 180, 210, 230, 260],
  ];
  const labels = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  return (
    <div className="erp-root theme-dark" style={{ display: 'flex', height: '100%', width: '100%', background: '#070A0C' }}>
      <Sidebar active="dashboard"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        {/* Oversized hero header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(180deg, color-mix(in oklch, var(--brand-900) 35%, #070A0C), #070A0C)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--brand-400)', marginBottom: 4 }}>● Live command center</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Tuesday, 21 April 2026</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm"><Icon name="calendar" size={13}/> This week</button>
              <button className="btn btn-accent btn-sm"><Icon name="sparkle" size={13}/> Ask AB Copilot</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: '1px solid var(--border)' }}>
            {[
              { l: 'Revenue', v: '₹ 48.2L', d: '+12.4%', sub: 'MTD', up: true },
              { l: 'Pipeline', v: '₹ 2.14Cr', d: '+6.1%', sub: '43 open deals', up: true },
              { l: 'Burn', v: '₹ 14.8L', d: '-2.3%', sub: 'MTD', up: true },
              { l: 'Runway', v: '18.2mo', d: '+0.4mo', sub: 'at current burn', up: true },
            ].map((k, i) => (
              <div key={i} style={{ padding: '18px 22px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{k.l}</div>
                <div className="num" style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>{k.v}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11.5 }}>
                  <span className={k.up ? 'kpi-delta-up' : 'kpi-delta-down'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Icon name={k.up ? 'arrowUp' : 'arrowDown'} size={10} stroke={2.5}/>{k.d}
                  </span>
                  <span style={{ color: 'var(--fg-muted)' }}>{k.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AI insight card */}
          <div className="card card-pad" style={{
            background: 'linear-gradient(135deg, color-mix(in oklch, var(--brand-800) 50%, transparent), color-mix(in oklch, var(--brand-900) 30%, var(--bg-elev)))',
            borderColor: 'color-mix(in oklch, var(--brand-500) 30%, transparent)',
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                <Icon name="sparkle" size={20}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--brand-300)' }}>AB Copilot · auto-insight</div>
                  <span className="chip chip-ok" style={{ height: 18, fontSize: 10 }}>Confident</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.4, marginBottom: 10 }}>
                  Brake pad stock will run out in <span style={{ color: 'var(--brand-300)' }}>11 days</span> at current velocity. Reorder <span className="num">840 units</span> from <span style={{ color: 'var(--brand-300)' }}>Sundaram</span> now to avoid stockout during the festival demand spike.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-accent btn-sm">Draft PO</button>
                  <button className="btn btn-secondary btn-sm">See forecast</button>
                  <button className="btn btn-ghost btn-sm">Dismiss</button>
                </div>
              </div>
            </div>
          </div>

          {/* 3-col main */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 16 }}>
            {/* Revenue vs target */}
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Revenue vs target</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>2026 · monthly</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--brand-500)' }}/> Actual</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--info)' }}/> Target</span>
                </div>
              </div>
              <AreaChart series={ser} labels={labels} width={460} height={200} colors={['var(--brand-400)','var(--info)']}/>
            </div>

            {/* Pipeline funnel */}
            <div className="card card-pad">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Sales funnel</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 16 }}>Current quarter</div>
              {[
                { s: 'Leads', n: 428, v: '₹ 8.2Cr', w: 100 },
                { s: 'Qualified', n: 186, v: '₹ 4.1Cr', w: 72 },
                { s: 'Proposal', n: 84, v: '₹ 2.4Cr', w: 48 },
                { s: 'Negotiation', n: 38, v: '₹ 1.2Cr', w: 28 },
                { s: 'Won', n: 22, v: '₹ 64L', w: 16 },
              ].map((r, i) => (
                <div key={r.s} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{r.s}</span>
                    <span style={{ color: 'var(--fg-muted)' }}><span className="num" style={{ fontWeight: 600, color: 'var(--fg)' }}>{r.n}</span> · {r.v}</span>
                  </div>
                  <div style={{ height: 18, borderRadius: 4, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                    <div style={{ width: `${r.w}%`, height: '100%', background: `color-mix(in oklch, var(--brand-500) ${100 - i * 12}%, var(--brand-900))` }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Risk feed</div>
                <span className="chip chip-err">4 active</span>
              </div>
              {[
                { l: 'Stockout risk · Brake pads',  t: 'Inventory',  c: 'err', ago: '8m' },
                { l: 'Invoice overdue · Ratnam Ltd', t: 'Finance', c: 'warn', ago: '2h' },
                { l: 'Shipment delayed · Dubai WH',  t: 'Logistics', c: 'warn', ago: '3h' },
                { l: 'Payment failure · SO-9412', t: 'Sales', c: 'err', ago: '1d' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 4, borderRadius: 2, background: `var(--${r.c === 'err' ? 'err' : 'warn'})`, flexShrink: 0 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.l}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>{r.t} · {r.ago} ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role board */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Team activity</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Role-based view · you see what your team is doing</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['All','Finance','Sales','Warehouse'].map((t, i) => (
                  <button key={t} className={`btn btn-sm ${i === 0 ? 'btn-secondary' : 'btn-ghost'}`} style={{ height: 26 }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { who: 'Anita Desai', role: 'Procurement Lead', task: 'Draft PO · Sundaram', prog: 60, c: 'var(--brand-500)' },
                { who: 'Sneha Rao', role: 'Sales Manager', task: 'Quote · Galaxy Motors', prog: 30, c: 'var(--info)' },
                { who: 'Vikram K.', role: 'Warehouse', task: 'Cycle count · WH-B', prog: 82, c: 'var(--c3)' },
                { who: 'Priya M.', role: 'Accounting', task: 'Reconcile HDFC', prog: 95, c: 'var(--c4)' },
              ].map(p => (
                <div key={p.who} style={{ padding: 12, background: 'var(--bg-sunken)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Av name={p.who}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{p.who}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>{p.role}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, marginBottom: 6 }}>{p.task}</div>
                  <Progress value={p.prog} color={p.c}/>
                  <div className="num" style={{ fontSize: 10.5, color: 'var(--fg-muted)', marginTop: 4 }}>{p.prog}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { DashboardV3 });
