import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearAdminSession } from '@/lib/auth';

type NavProps = {
  current: 'dashboard' | 'clients' | 'leads' | 'payments' | 'refunds' | 'stripe' | 'debug';
};

export function Nav({ current }: NavProps) {
  async function logout() {
    'use server';
    await clearAdminSession();
    redirect('/login');
  }

  const links = [
    { href: '/', label: 'Dashboard', key: 'dashboard' },
    { href: '/clientes', label: 'Clientes', key: 'clients' },
    { href: '/leads', label: 'Leads', key: 'leads' },
    { href: '/pagamentos', label: 'Pagamentos', key: 'payments' },
    { href: '/reembolsos', label: 'Reembolsos', key: 'refunds' },
    { href: '/stripe', label: 'Stripe', key: 'stripe' },
    { href: '/debug', label: 'Debug', key: 'debug' },
  ] as const;

  return (
    <div className="nav-shell">
      <div className="container" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div className="nav-inner">
          <div className="nav-left">
            <Link href="/" prefetch={false} className="brand">
              Imigra Painel
            </Link>
            <div className="nav-links">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  aria-current={current === link.key ? 'page' : undefined}
                  className={`nav-link ${current === link.key ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <form action={logout}>
            <button type="submit" className="btn btn-ghost">
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
