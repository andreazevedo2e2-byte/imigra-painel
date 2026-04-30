import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatBusinessStatus, formatCurrencyBRL, formatDateTime } from '@/lib/admin-presenters';
import { getAdminSnapshot, getPaymentAmountCents } from '@/lib/admin-data';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function requestRefund(formData: FormData) {
  'use server';

  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const paymentId = String(formData.get('payment_id') ?? '').trim();
  if (!paymentId) redirect('/pagamentos?error=' + encodeURIComponent('Pagamento invalido.'));

  const supabase = supabaseAdmin();
  const { data: payment } = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!payment) redirect('/pagamentos?error=' + encodeURIComponent('Pagamento nao encontrado.'));
  if (!payment.user_id) redirect('/pagamentos?error=' + encodeURIComponent('Pagamento sem user_id.'));

  const { data: existing } = await supabase
    .from('refund_requests')
    .select('id,status')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: false })
    .limit(1);

  const last = existing?.[0] ?? null;
  if (last && (last.status === 'pending' || last.status === 'processing' || last.status === 'processed')) {
    redirect('/pagamentos?success=' + encodeURIComponent('Este pagamento ja tem um pedido de reembolso.'));
  }

  await supabase.from('refund_requests').insert({
    user_id: payment.user_id,
    payment_id: paymentId,
    stripe_payment_intent_id: payment.stripe_payment_intent_id ?? null,
    status: 'pending',
  });

  // Mark the payment with the request timestamp (operational signal).
  try {
    await supabase.from('payments').update({ refund_requested_at: new Date().toISOString() }).eq('id', paymentId);
  } catch {
    // ignore
  }

  revalidatePath('/reembolsos');
  revalidatePath('/pagamentos');
  redirect('/pagamentos?success=' + encodeURIComponent('Pedido de reembolso criado. Veja a fila em Reembolsos.'));
}

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const snapshot = await getAdminSnapshot();
  const sp = await searchParams;
  const rows = snapshot.raw.payments
    .slice()
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const refundsByPayment = new Map<string, Array<(typeof snapshot.raw.refunds)[number]>>();
  for (const refund of snapshot.raw.refunds) {
    if (!refund.payment_id) continue;
    refundsByPayment.set(refund.payment_id, [...(refundsByPayment.get(refund.payment_id) ?? []), refund]);
  }

  return (
    <>
      <Nav current="payments" />
      <div className="container stack">
        <div className="card highlight-panel page-head">
          <div>
            <div className="page-title">Pagamentos</div>
            <div className="page-subtitle">Vendas, status de pagamento e pedidos de reembolso.</div>
          </div>
          <div className="badge-row">
            <span className="pill">Vendas concluidas: <strong>{snapshot.metrics.completedSales}</strong></span>
            <span className="pill success">Receita bruta: <strong>{formatCurrencyBRL(snapshot.metrics.revenueBrutaCents / 100)}</strong></span>
            <span className="pill warn">Reembolso pendente: <strong>{snapshot.metrics.refundPendingCount}</strong></span>
          </div>
        </div>

        {sp.success ? <div className="card soft" style={{ borderColor: 'rgba(79, 209, 165, 0.25)' }}>{sp.success}</div> : null}
        {sp.error ? <div className="card soft" style={{ borderColor: 'rgba(255, 125, 125, 0.25)' }}>{sp.error}</div> : null}

        <div className="grid">
          <div className="col-3">
            <StatCard label="Vendas concluidas" value={String(snapshot.metrics.completedSales)} />
          </div>
          <div className="col-3">
            <StatCard label="Receita bruta" value={formatCurrencyBRL(snapshot.metrics.revenueBrutaCents / 100)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolso pendente" value={String(snapshot.metrics.refundPendingCount)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolsos concluidos" value={String(snapshot.metrics.refundProcessedCount)} />
          </div>
        </div>

        <div className="card table-card">
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
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((payment) => {
                  const profile = payment.user_id ? snapshot.raw.profileById.get(payment.user_id) : null;
                  const amountCents = getPaymentAmountCents(payment);
                  const linkedRefunds = refundsByPayment.get(payment.id) ?? [];
                  const hasProcessedRefund =
                    payment.status === 'refunded' || linkedRefunds.some((refund) => refund.status === 'processed');
                  const hasPendingRefund =
                    payment.status === 'refund_pending' ||
                    linkedRefunds.some((refund) => refund.status === 'pending' || refund.status === 'processing');
                  const displayStatus = hasProcessedRefund
                    ? 'Reembolsado'
                    : hasPendingRefund
                      ? 'Reembolso em analise'
                      : formatBusinessStatus(payment.status);
                  return (
                    <tr key={payment.id}>
                      <td>
                        {payment.user_id ? (
                          <Link href={`/pessoas/${payment.user_id}?tab=pagamentos`} prefetch={false}>
                            {profile?.full_name || 'Cliente sem nome'}
                          </Link>
                        ) : (
                          profile?.full_name || 'Cliente sem nome'
                        )}
                      </td>
                      <td className="muted">{profile?.email || 'Sem e-mail'}</td>
                      <td>{formatCurrencyBRL(amountCents / 100)}</td>
                      <td>{displayStatus}</td>
                      <td className="muted">{formatDateTime(payment.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {hasProcessedRefund ? (
                            <span className="pill danger">Reembolsado</span>
                          ) : hasPendingRefund ? (
                            <span className="pill warn">Em analise</span>
                          ) : payment.status === 'completed' ? (
                            <form action={requestRefund}>
                              <input type="hidden" name="payment_id" value={payment.id} />
                              <button className="btn btn-primary" type="submit">
                                Solicitar reembolso
                              </button>
                            </form>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </div>
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
