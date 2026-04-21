import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatBusinessStatus, formatCurrencyBRL, formatDateTime } from '@/lib/admin-presenters';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getPaymentView() {
  const supabase = supabaseAdmin();
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id,user_id,amount,status,created_at,refund_requested_at,refunded_at')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error('Failed to load payments:', error);
    return { rows: [], totals: { revenue: 0, sales: 0, refunds: 0, pending: 0 } };
  }

  const profileIds = Array.from(new Set((payments ?? []).map((payment) => payment.user_id).filter(Boolean)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,full_name,email')
    .in('id', profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000']);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const completed = (payments ?? []).filter((payment) => payment.status === 'completed');

  return {
    rows: (payments ?? []).map((payment) => {
      const profile = payment.user_id ? profilesById.get(payment.user_id) : null;
      return {
        id: payment.id,
        name: profile?.full_name || 'Cliente sem nome',
        email: profile?.email || 'Sem e-mail',
        amount: payment.amount ?? 0,
        status: formatBusinessStatus(payment.status),
        createdAt: payment.created_at,
        refundRequestedAt: payment.refund_requested_at,
        refundedAt: payment.refunded_at,
        userId: payment.user_id,
      };
    }),
    totals: {
      revenue: completed.reduce((sum, payment) => sum + (payment.amount ?? 0), 0),
      sales: completed.length,
      refunds: (payments ?? []).filter((payment) => payment.status === 'refunded').length,
      pending: (payments ?? []).filter((payment) => payment.status === 'refund_pending').length,
    },
  };
}

export default async function PagamentosPage() {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const data = await getPaymentView();

  return (
    <>
      <Nav current="payments" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Pagamentos</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
            Vendas, situacao do cliente e pedidos de reembolso num lugar so.
          </h1>
          <p className="muted" style={{ marginTop: 14, maxWidth: 720, fontSize: 17 }}>
            Aqui voce acompanha o que entrou, o que ainda esta em analise e quais clientes podem
            precisar de uma acao manual.
          </p>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Faturamento acumulado" value={formatCurrencyBRL(data.totals.revenue / 100)} />
          </div>
          <div className="col-3">
            <StatCard label="Vendas confirmadas" value={String(data.totals.sales)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolsos concluidos" value={String(data.totals.refunds)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolsos em analise" value={String(data.totals.pending)} />
          </div>
        </div>

        <div className="card">
          <div className="section-title">Lista de pagamentos</div>
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Valor</th>
                  <th>Situacao</th>
                  <th>Data da compra</th>
                  <th>Reembolso</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.userId ? (
                        <Link href={`/leads/${row.userId}`} prefetch={false}>
                          {row.name}
                        </Link>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="muted">{row.email}</td>
                    <td>{formatCurrencyBRL(row.amount / 100)}</td>
                    <td>{row.status}</td>
                    <td className="muted">{formatDateTime(row.createdAt)}</td>
                    <td className="muted">
                      {row.refundedAt
                        ? `Concluido em ${formatDateTime(row.refundedAt)}`
                        : row.refundRequestedAt
                          ? `Pedido em ${formatDateTime(row.refundRequestedAt)}`
                          : 'Sem pedido'}
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Ainda nao ha pagamentos salvos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

