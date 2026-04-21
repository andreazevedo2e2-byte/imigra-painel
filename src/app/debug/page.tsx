import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { getPaymentConnectedAccountId, getAdminSnapshot, updateUserAccessFlag, type PaymentRow, type RefundRow } from '@/lib/admin-data';
import { requireAdminSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

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
        error_message: stripeRefund.failure_reason ?? 'Refund falhou ou foi cancelado na Stripe.',
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

async function reconcileRecent() {
  'use server';

  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const env = getEnv();
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

  let updated = 0;

  for (const refund of refunds) {
    if (!refund.payment_id) continue;
    const payment = paymentsById.get(refund.payment_id);
    if (!payment) continue;
    const changed = await syncRefundWithStripe(stripe, payment, refund);
    if (changed) updated += 1;
  }

  revalidatePath('/');
  revalidatePath('/clientes');
  revalidatePath('/leads');
  revalidatePath('/pagamentos');
  revalidatePath('/reembolsos');
  revalidatePath('/debug');

  redirect(`/debug?success=${encodeURIComponent(`${updated} registro(s) reconciliados com a Stripe.`)}`);
}

export default async function DebugPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const snapshot = await getAdminSnapshot();
  const env = getEnv();
  const supabaseInfo = projectRefFromUrl(env.SUPABASE_URL);
  const sp = await searchParams;

  return (
    <>
      <Nav current="debug" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Debug</div>
          <div className="muted">Use esta tela para conferir se o painel esta lendo o projeto certo.</div>
        </div>

        {sp.success ? <div className="card" style={{ borderColor: 'rgba(79, 209, 165, 0.25)' }}>{sp.success}</div> : null}

        <div className="grid">
          <div className="col-3">
            <StatCard label="Profiles" value={String(snapshot.counts.profiles)} />
          </div>
          <div className="col-3">
            <StatCard label="Payments" value={String(snapshot.counts.payments)} />
          </div>
          <div className="col-3">
            <StatCard label="Refund requests" value={String(snapshot.counts.refundRequests)} />
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
          <form action={reconcileRecent}>
            <button className="btn btn-primary" type="submit">
              Reconciliar com Stripe
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
