import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { getPaymentConnectedAccountId, getAdminSnapshot, updateUserAccessFlag, type PaymentRow, type RefundRow, getPaymentAmountCents } from '@/lib/admin-data';
import { requireAdminSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';
import { formatCurrencyBRL, formatDateTime } from '@/lib/admin-presenters';

export const dynamic = 'force-dynamic';

function projectRefFromUrl(url: string) {
  try {
    const host = new URL(url).host;
    return { host, projectRef: host.split('.')[0] ?? host };
  } catch {
    return { host: url, projectRef: url };
  }
}

async function syncRefundWithStripe(stripe: Stripe, payment: PaymentRow, refund: RefundRow) {
  const supabase = supabaseAdmin();
  const stripeAccount = getPaymentConnectedAccountId(payment);

  let stripeRefundId = refund.stripe_refund_id ?? payment.stripe_refund_id ?? null;

  if (!stripeRefundId && payment.stripe_payment_intent_id) {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      payment.stripe_payment_intent_id,
      { expand: ['latest_charge.refunds'] },
      { stripeAccount }
    );

    const latestCharge = paymentIntent.latest_charge;
    if (latestCharge && typeof latestCharge !== 'string') {
      stripeRefundId = latestCharge.refunds?.data?.[0]?.id ?? null;
    }
  }

  if (!stripeRefundId) return false;

  const stripeRefund = await stripe.refunds.retrieve(stripeRefundId, undefined, { stripeAccount });

  if (stripeRefund.status === 'succeeded') {
    await supabase
      .from('payments')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString(),
        stripe_refund_id: stripeRefund.id,
      })
      .eq('id', payment.id);

    await supabase
      .from('refund_requests')
      .update({
        status: 'processed',
        stripe_refund_id: stripeRefund.id,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', refund.id);

    await updateUserAccessFlag(payment.user_id!);
    return true;
  }

  if (stripeRefund.status === 'failed' || stripeRefund.status === 'canceled') {
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        stripe_refund_id: stripeRefund.id,
      })
      .eq('id', payment.id);

    await supabase
      .from('refund_requests')
      .update({
        status: 'failed',
        stripe_refund_id: stripeRefund.id,
        processed_at: new Date().toISOString(),
        error_message: stripeRefund.failure_reason ?? 'Reembolso falhou ou foi cancelado na Stripe.',
      })
      .eq('id', refund.id);

    return true;
  }

  await supabase
    .from('refund_requests')
    .update({
      status: 'processing',
      stripe_refund_id: stripeRefund.id,
      error_message: null,
    })
    .eq('id', refund.id);

  return true;
}

async function safeUpdatePayment(paymentId: string, payload: Record<string, unknown>) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('payments').update(payload).eq('id', paymentId);
  if (!error) return;
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  // If schema is missing optional columns, retry without them.
  const optional = ['application_fee_cents', 'refunded_amount_cents', 'amount_cents', 'currency', 'stripe_charge_id', 'customer_email'];
  const missing = optional.filter((col) => message.includes(col));
  if (missing.length === 0) throw error;
  const fallback = { ...payload };
  missing.forEach((col) => delete (fallback as any)[col]);
  const retry = await supabase.from('payments').update(fallback).eq('id', paymentId);
  if (retry.error) throw retry.error;
}

async function reconcileRecent(formData: FormData) {
  'use server';

  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const env = getEnv();
  if (env.ENABLE_ADMIN_DEBUG !== 'true') redirect('/');

  const confirm = String(formData.get('confirm') ?? '').trim();
  if (confirm !== 'RECONCILIAR') {
    redirect(`/debug?error=${encodeURIComponent('Confirmacao invalida. Digite RECONCILIAR para executar.')}`);
  }

  const supabase = supabaseAdmin();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [paymentsRes, refundsRes] = await Promise.all([
    supabase
      .from('payments')
      .select('*')
      .gte('created_at', since)
      .in('status', ['refund_pending', 'completed']),
    supabase
      .from('refund_requests')
      .select('*')
      .gte('created_at', since)
      .in('status', ['pending', 'processing']),
  ]);

  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const refunds = (refundsRes.data ?? []) as RefundRow[];
  const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));

  let updatedRefunds = 0;
  let updatedPayments = 0;

  for (const refund of refunds) {
    if (!refund.payment_id) continue;
    const payment = paymentsById.get(refund.payment_id);
    if (!payment) continue;
    const changed = await syncRefundWithStripe(stripe, payment, refund);
    if (changed) updatedRefunds += 1;
  }

  // Enrich payments with source-of-truth data from Stripe (amount/currency/fee/refunded amount).
  for (const payment of payments.slice(0, 80)) {
    if (!payment.stripe_payment_intent_id) continue;
    const stripeAccount = getPaymentConnectedAccountId(payment);
    try {
      const pi = await stripe.paymentIntents.retrieve(
        payment.stripe_payment_intent_id,
        { expand: ['latest_charge.refunds'] },
        { stripeAccount }
      );

      const latestCharge = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge : null;
      const refundsData = latestCharge?.refunds?.data ?? [];
      const refundedAmountCents =
        refundsData.length > 0 ? refundsData.reduce((sum, r) => sum + (r.amount ?? 0), 0) : null;

      const payload: Record<string, unknown> = {
        amount_cents: pi.amount_received ?? pi.amount ?? null,
        currency: pi.currency ?? null,
        stripe_charge_id: typeof pi.latest_charge === 'string' ? pi.latest_charge : null,
        application_fee_cents: (pi as any).application_fee_amount ?? null,
        refunded_amount_cents: refundedAmountCents,
      };

      // Only write when it actually adds something new (avoid extra writes).
      const nextAmount = typeof payload.amount_cents === 'number' ? (payload.amount_cents as number) : null;
      const currentAmount = getPaymentAmountCents(payment);
      const shouldWrite =
        (nextAmount !== null && nextAmount !== currentAmount) ||
        (payload.currency && (payment as any).currency !== payload.currency) ||
        (payload.stripe_charge_id && (payment as any).stripe_charge_id !== payload.stripe_charge_id) ||
        (payload.application_fee_cents !== null && (payment as any).application_fee_cents !== payload.application_fee_cents) ||
        (payload.refunded_amount_cents !== null && (payment as any).refunded_amount_cents !== payload.refunded_amount_cents);

      if (shouldWrite) {
        await safeUpdatePayment(payment.id, payload);
        updatedPayments += 1;
      }
    } catch (error) {
      console.warn('Debug reconcile failed for payment', {
        paymentId: payment.id,
        paymentIntentId: payment.stripe_payment_intent_id,
        stripeAccount,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  revalidatePath('/');
  revalidatePath('/clientes');
  revalidatePath('/leads');
  revalidatePath('/pagamentos');
  revalidatePath('/reembolsos');
  revalidatePath('/pessoas');
  revalidatePath('/debug');

  const msg = `Reconciliado: ${updatedPayments} pagamento(s) e ${updatedRefunds} reembolso(s).`;
  console.log(msg);
  redirect(`/debug?success=${encodeURIComponent(msg)}`);
}

export default async function DebugPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const snapshot = await getAdminSnapshot();
  const env = getEnv();
  if (env.ENABLE_ADMIN_DEBUG !== 'true') redirect('/');

  const supabaseInfo = projectRefFromUrl(env.SUPABASE_URL);
  const sp = await searchParams;
  const recentPayments = snapshot.raw.payments
    .slice()
    .sort((a: any, b: any) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 5);

  return (
    <>
      <Nav current="debug" />
      <div className="container stack">
        <div className="card highlight-panel page-head">
          <div>
            <div className="page-title">Debug</div>
            <div className="page-subtitle">Conferir se o painel esta lendo o projeto certo e reconciliar dados.</div>
          </div>
          <div className="badge-row">
            <span className="pill">Supabase: <strong>{supabaseInfo.projectRef}</strong></span>
            <span className="pill">Admin: <strong>{adminSession.email}</strong></span>
          </div>
        </div>

        {sp.success ? <div className="card soft" style={{ borderColor: 'rgba(79, 209, 165, 0.25)' }}>{sp.success}</div> : null}
        {sp.error ? <div className="card soft" style={{ borderColor: 'rgba(255, 125, 125, 0.25)' }}>{sp.error}</div> : null}

        <div className="grid">
          <div className="col-3">
            <StatCard label="Profiles" value={String(snapshot.counts.profiles)} />
          </div>
          <div className="col-3">
            <StatCard label="Payments" value={String(snapshot.counts.payments)} />
          </div>
          <div className="col-3">
            <StatCard label="Pedidos de reembolso" value={String(snapshot.counts.refundRequests)} />
          </div>
          <div className="col-3">
            <StatCard label="Project ref" value={supabaseInfo.projectRef} />
          </div>
        </div>

        <div className="card">
          <div className="section-title">Origem de dados</div>
          <div className="kv-grid">
            <div className="kv-card">
              <div className="kv-label">SUPABASE_URL</div>
              <div className="kv-value">{supabaseInfo.host}</div>
            </div>
            <div className="kv-card">
              <div className="kv-label">Admin logado</div>
              <div className="kv-value">{adminSession.email}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Reconciliacao</div>
          <div className="muted" style={{ marginBottom: 16 }}>
            Confere os ultimos 30 dias e corrige pagamentos ou reembolsos pendentes usando a Stripe.
          </div>
          <form action={reconcileRecent} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" name="confirm" placeholder="Digite RECONCILIAR para confirmar" style={{ maxWidth: 320 }} />
            <button className="btn btn-primary" type="submit">Reconciliar com Stripe</button>
          </form>
          <div className="muted" style={{ marginTop: 12 }}>
            Isso nao afeta checkout do cliente. Apenas atualiza dados no Supabase para o painel.
          </div>
        </div>

        <div className="card">
          <div className="section-title">Ultimos pagamentos (amostra)</div>
          {recentPayments.length === 0 ? (
            <div className="muted">Nenhum pagamento encontrado.</div>
          ) : (
            <div className="table-shell">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td className="muted">{String(payment.id).slice(0, 8)}…</td>
                      <td className="muted">{formatCurrencyBRL(getPaymentAmountCents(payment) / 100)}</td>
                      <td className="muted">{String(payment.status ?? '—')}</td>
                      <td className="muted">{payment.created_at ? formatDateTime(payment.created_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
