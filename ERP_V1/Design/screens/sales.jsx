// AB_SPARES ERP — Sales & CRM (pipeline kanban + orders)

const SalesScreen = () => {
  const stages = [
    { n: 'Leads', c: 'var(--fg-muted)', deals: [
      { co: 'Titan Motors · Chennai', a: '₹ 4.8L', who: 'Sneha R.', age: '2d' },
      { co: 'Prakash Auto',           a: '₹ 62k',  who: 'Ravi S.',  age: '3d' },
    ]},
    { n: 'Qualified', c: 'var(--info)', deals: [
      { co: 'Galaxy Motors · SG', a: 'S$ 18k', who: 'Sneha R.', age: '5d' },
      { co: 'Zippy Garage · Pune', a: '₹ 1.2L', who: 'Anita D.', age: '1w' },
      { co: 'Hot Wheels Club', a: '₹ 84k', who: 'Ravi S.', age: '1w' },
    ]},
    { n: 'Proposal', c: 'var(--c3)', deals: [
      { co: 'MRF Partners · Dubai', a: 'د.إ 42k', who: 'Priya M.', age: '2w', hot: true },
      { co: 'Nitro Racing',         a: '₹ 2.1L', who: 'Sneha R.', age: '2w' },
    ]},
    { n: 'Negotiation', c: 'var(--c4)', deals: [
      { co: 'Swift Wheels LLP', a: '₹ 3.4L', who: 'Ravi S.', age: '3w', hot: true },
    ]},
    { n: 'Won', c: 'var(--ok)', deals: [
      { co: 'Desai Autoworks', a: '₹ 1.1L', who: 'Anita D.', age: '1w' },
      { co: 'Karthik & Sons',  a: '₹ 18k',  who: 'Sneha R.', age: '2d' },
    ]},
  ];

  return (
    <div className="erp-root" style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar active="sales"/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        <Topbar
          breadcrumbs={['Sales & CRM', 'Pipeline']}
          title="Deal pipeline"
          subtitle="12 deals · ₹ 2.14 Cr potential"
          right={<>
            <button className="btn btn-secondary btn-sm"><Icon name="grid" size={13}/> Kanban</button>
            <button className="btn btn-ghost btn-sm"><Icon name="list" size={13}/></button>
            <button className="btn btn-primary btn-sm"><Icon name="plus" size={13}/> New deal</button>
          </>}
        />
        <div style={{ padding: 20, background: 'var(--bg-sunken)', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))', gap: 12 }}>
            {stages.map(st => (
              <div key={st.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 4px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: st.c }}/>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{st.n}</span>
                  <span className="num" style={{ fontSize: 11, color: 'var(--fg-muted)', marginLeft: 'auto' }}>{st.deals.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {st.deals.map((d, i) => (
                    <div key={i} className="card card-pad-sm" style={{ cursor: 'grab' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>{d.co}</div>
                        {d.hot && <Icon name="flame" size={13} color="var(--warn)"/>}
                      </div>
                      <div className="num" style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2, marginBottom: 8 }}>{d.a}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Av name={d.who} size="sm"/>
                        <span style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>{d.who}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginLeft: 'auto' }}>{d.age}</span>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--fg-subtle)' }}><Icon name="plus" size={12}/> Add card</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SalesScreen });
