import Link from 'next/link';

export function Nav() {
  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/leads', label: 'Leads' },
    { href: '/pagamentos', label: 'Pagamentos' },
    { href: '/reembolsos', label: 'Reembolsos' },
    { href: '/stripe', label: 'Stripe' },
  ];

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backdropFilter: 'blur(12px)',
        background: 'rgba(6, 8, 18, 0.75)',
        borderBottom: '1px solid rgba(55, 65, 81, 0.5)',
      }}
    >
      <div className="container" style={{ paddingTop: 14, paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <Link href="/" style={{ fontWeight: 900, letterSpacing: -0.2 }}>
              Imigra Painel
            </Link>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch={false}
                  className="muted"
                  style={{ fontSize: 13, padding: '6px 10px', borderRadius: 999 }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <Link href="/logout" className="btn btn-ghost" style={{ fontSize: 13 }}>
            Sair
          </Link>
        </div>
      </div>
    </div>
  );
}
