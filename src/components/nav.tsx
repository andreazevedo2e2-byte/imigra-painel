import Link from 'next/link';
import { redirect } from 'next/navigation';
import { clearAdminSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';

type NavProps = {
  current:
    | 'dashboard'
    | 'clients'
    | 'leads'
    | 'payments'
    | 'refunds'
    | 'stripe'
    | 'debug'
    | 'person';
};

export function Nav({ current }: NavProps) {
  async function logout() {
    'use server';
    await clearAdminSession();
    redirect('/login');
  }

  const env = getEnv();
  const showAdvancedAdmin = env.ENABLE_ADMIN_DEBUG === 'true';

  const mainLinks = [
    { href: '/', label: 'Dashboard', key: 'dashboard' },
    { href: '/clientes', label: 'Clientes', key: 'clients' },
    { href: '/leads', label: 'Leads', key: 'leads' },
    { href: '/pagamentos', label: 'Pagamentos', key: 'payments' },
    { href: '/reembolsos', label: 'Reembolsos', key: 'refunds' },
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
              {mainLinks.map((link) => (
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

              {showAdvancedAdmin ? (
                <div className="nav-dropdown">
                  <button
                    type="button"
                    className={`nav-link nav-dropdown-trigger ${current === 'stripe' || current === 'debug' ? 'active' : ''}`}
                    aria-haspopup="menu"
                  >
                    Configuracoes
                  </button>
                  <div className="nav-dropdown-menu" role="menu">
                    <Link
                      href="/stripe"
                      prefetch={false}
                      aria-current={current === 'stripe' ? 'page' : undefined}
                      className={`nav-dropdown-item ${current === 'stripe' ? 'active' : ''}`}
                    >
                      Stripe
                    </Link>
                    <Link
                      href="/debug"
                      prefetch={false}
                      aria-current={current === 'debug' ? 'page' : undefined}
                      className={`nav-dropdown-item ${current === 'debug' ? 'active' : ''}`}
                    >
                      Debug
                    </Link>
                  </div>
                </div>
              ) : null}
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
