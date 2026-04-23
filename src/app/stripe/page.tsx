import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

type CapabilityState = 'active' | 'inactive' | 'pending' | 'unrequested' | 'unknown';

function getStripeClient() {
  const env = getEnv();
  return {
    env,
    stripe: new Stripe(env.STRIPE_SECRET_KEY),
  };
}

function normalizeCapability(value: string | null | undefined): CapabilityState {
  if (value === 'active' || value === 'inactive' || value === 'pending' || value === 'unrequested') {
    return value;
  }
  return 'unknown';
}

function formatCapabilityLabel(value: CapabilityState) {
  switch (value) {
    case 'active':
      return 'Ativa';
    case 'inactive':
      return 'Inativa';
    case 'pending':
      return 'Pendente';
    case 'unrequested':
      return 'Nao solicitada';
    default:
      return 'Desconhecida';
  }
}

function formatBooleanLabel(value: boolean | undefined) {
  if (value === true) return 'Sim';
  if (value === false) return 'Nao';
  return 'Desconhecido';
}

export default async function StripePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const { env, stripe } = getStripeClient();
  if (env.ENABLE_ADMIN_DEBUG !== 'true') redirect('/');

  const sp = await searchParams;
  const account = await stripe.accounts.retrieve(env.STRIPE_CONNECT_DESTINATION_ACCOUNT_ID);

  const cardPayments = normalizeCapability(account.capabilities?.card_payments);
  const currentlyDue = account.requirements?.currently_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;
  const connectedDashboardUrl = `https://dashboard.stripe.com/connect/accounts/${encodeURIComponent(env.STRIPE_CONNECT_DESTINATION_ACCOUNT_ID)}`;

  return (
    <>
      <Nav current="stripe" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Stripe Connect</div>
          <div className="muted">
            Status real da conta conectada usada no checkout do Rodrigo.
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Pix pode nao ser habilitavel nesta configuracao. A capability <strong>pix_payments</strong> pode nao ser
            requestable para BR via API. Use o Dashboard da Stripe (na conta conectada) e complete as pendencias para
            habilitar metodos de pagamento.
          </div>
        </div>

        {sp.success ? (
          <div className="card" style={{ borderColor: 'rgba(79, 209, 165, 0.25)' }}>
            {sp.success}
          </div>
        ) : null}
        {sp.error ? (
          <div className="card" style={{ borderColor: 'rgba(248, 113, 113, 0.25)' }}>
            {sp.error}
          </div>
        ) : null}

        <div className="grid">
          <div className="col-3">
            <StatCard label="Pais da conta" value={account.country ?? '—'} />
          </div>
          <div className="col-3">
            <StatCard label="Receber cobrancas" value={formatBooleanLabel(account.charges_enabled)} />
          </div>
          <div className="col-3">
            <StatCard label="Receber repasses" value={formatBooleanLabel(account.payouts_enabled)} />
          </div>
          <div className="col-3">
            <StatCard label="card_payments" value={formatCapabilityLabel(cardPayments)} />
          </div>
        </div>

        <div className="grid">
          <div className="col-6">
            <div className="card">
              <div className="section-title">Capabilities</div>
              <div className="kv-grid">
                <div className="kv-card">
                  <div className="kv-label">card_payments</div>
                  <div className="kv-value">{formatCapabilityLabel(cardPayments)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-6">
            <div className="card">
              <div className="section-title">Links</div>
              <div className="muted" style={{ marginBottom: 16 }}>
                Acesse a conta conectada diretamente no Dashboard da Stripe.
              </div>
              <a className="btn btn-primary" href={connectedDashboardUrl} target="_blank" rel="noreferrer">
                Abrir conta conectada no Stripe
              </a>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Pendencias da conta</div>
          <div className="kv-grid">
            <div className="kv-card">
              <div className="kv-label">disabled_reason</div>
              <div className="kv-value">{disabledReason ?? 'Nenhum'}</div>
            </div>
            <div className="kv-card">
              <div className="kv-label">currently_due</div>
              <div className="kv-value">
                {currentlyDue.length > 0 ? `${currentlyDue.length} item(ns)` : 'Nenhum'}
              </div>
            </div>
          </div>

          {currentlyDue.length > 0 ? (
            <div className="table-shell" style={{ marginTop: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Campo pendente</th>
                  </tr>
                </thead>
                <tbody>
                  {currentlyDue.map((item) => (
                    <tr key={item}>
                      <td>{item}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 16 }}>
              Nenhuma exigencia pendente no momento.
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">Conta conectada</div>
          <div className="kv-grid">
            <div className="kv-card">
              <div className="kv-label">Connected account</div>
              <div className="kv-value">{env.STRIPE_CONNECT_DESTINATION_ACCOUNT_ID}</div>
            </div>
            <div className="kv-card">
              <div className="kv-label">Admin logado</div>
              <div className="kv-value">{adminSession.email}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
