import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatBusinessStatus, formatCurrencyBRL, formatDateTime } from '@/lib/admin-presenters';
import { getAdminSnapshot, getPaymentAmountCents } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

export default async function PagamentosPage() {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const snapshot = await getAdminSnapshot();
  const rows = snapshot.raw.payments
    .slice()
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  return (
    <>
      <Nav current="payments" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Pagamentos</div>
          <div className="muted">Fonte de verdade: tabela payments do Supabase.</div>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Vendas concluidas" value={String(snapshot.metrics.completedSales)} />
          </div>
          <div className="col-3">
            <StatCard label="Receita bruta" value={formatCurrencyBRL(snapshot.metrics.revenueBrutaCents / 100)} />
          </div>
          <div className="col-3">
            <StatCard label="Refund pendente" value={String(snapshot.metrics.refundPendingCount)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolsos concluidos" value={String(snapshot.metrics.refundProcessedCount)} />
          </div>
        </div>

        <div className="card">
          <div className="section-title">Lista</div>
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Compra</th>
                  <th>Reembolso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => {
                  const profile = payment.user_id ? snapshot.raw.profileById.get(payment.user_id) : null;
                  return (
                    <tr key={payment.id}>
                      <td>
                        {payment.user_id ? (
                          <Link href={`/leads/${payment.user_id}`} prefetch={false}>
                            {profile?.full_name || 'Cliente sem nome'}
                          </Link>
                        ) : (
                          profile?.full_name || 'Cliente sem nome'
                        )}
                      </td>
                      <td className="muted">{profile?.email || 'Sem e-mail'}</td>
                      <td>{formatCurrencyBRL(getPaymentAmountCents(payment) / 100)}</td>
                      <td>{formatBusinessStatus(payment.status)}</td>
                      <td className="muted">{formatDateTime(payment.created_at)}</td>
                      <td className="muted">
                        {payment.refunded_at
                          ? `Concluido em ${formatDateTime(payment.refunded_at)}`
                          : payment.refund_requested_at
                            ? `Pedido em ${formatDateTime(payment.refund_requested_at)}`
                            : 'Sem pedido'}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">Nenhum pagamento encontrado.</td>
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
