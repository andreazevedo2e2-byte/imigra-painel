import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type RefundRow = {
  id: string;
  user_id: string;
  payment_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  reason: string | null;
  status: string;
  created_at: string;
};

type PaymentRow = {
  id: string;
  created_at: string | null;
  amount: number | null;
  status: string | null;
  stripe_payment_intent_id: string | null;
  user_id: string | null;
};

function saoPauloDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`; // YYYY-MM-DD
}

function daysDiffCalendarSaoPaulo(from: Date, to: Date) {
  // "Ate o 7o dia do calendario" => compare calendar dates in Sao Paulo TZ.
  const a = saoPauloDateKey(from);
  const b = saoPauloDateKey(to);
  const aMs = Date.parse(a + 'T00:00:00Z');
  const bMs = Date.parse(b + 'T00:00:00Z');
  return Math.floor((bMs - aMs) / (1000 * 60 * 60 * 24));
}

async function getRefundQueue() {
  const supabase = supabaseAdmin();
  const { data: refundRequests, error } = await supabase
    .from('refund_requests')
    .select(
      'id,user_id,payment_id,stripe_payment_intent_id,stripe_refund_id,reason,status,created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('Failed to load refund_requests:', error);
    return { rows: [] as RefundRow[], paymentsById: new Map<string, PaymentRow>() };
  }

  const paymentIds = (refundRequests ?? [])
    .map((r: any) => r.payment_id)
    .filter(Boolean) as string[];

  const paymentsById = new Map<string, PaymentRow>();
  if (paymentIds.length) {
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('id,created_at,amount,status,stripe_payment_intent_id,user_id')
      .in('id', paymentIds);
    if (payErr) {
      console.error('Failed to load payments for refund queue:', payErr);
    } else {
      for (const p of payments ?? []) paymentsById.set((p as any).id, p as any);
    }
  }

  return { rows: (refundRequests ?? []) as RefundRow[], paymentsById };
}

async function approveRefund(formData: FormData) {
  'use server';

  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const refundRequestId = String(formData.get('refund_request_id') ?? '').trim();
  if (!refundRequestId) redirect('/reembolsos');

  const env = getEnv();
  // Stripe env vars are mandatory in this project (validated in getEnv()).

  const supabase = supabaseAdmin();
  const { data: rr, error: rrErr } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('id', refundRequestId)
    .maybeSingle();
  if (rrErr || !rr) {
    console.error('Failed to load refund request:', rrErr);
    redirect('/reembolsos');
  }

  const paymentId = (rr as any).payment_id as string | null;
  const stripePaymentIntentId =
    ((rr as any).stripe_payment_intent_id as string | null) ?? null;

  let payment: any = null;
  if (paymentId) {
    const { data: p } = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle();
    payment = p;
  } else if (stripePaymentIntentId) {
    const { data: p } = await supabase
      .from('payments')
      .select('*')
      .eq('stripe_payment_intent_id', stripePaymentIntentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    payment = p;
  }

  const paymentCreatedAt = payment?.created_at ? new Date(payment.created_at) : null;
  if (!paymentCreatedAt) {
    throw new Error('Payment not found or missing created_at; cannot validate 7-day policy.');
  }

  const diffDays = daysDiffCalendarSaoPaulo(paymentCreatedAt, new Date());
  if (diffDays > 7) {
    throw new Error(`Refund blocked: purchase is ${diffDays} days old (policy is up to 7 calendar days).`);
  }

  const pi = (payment?.stripe_payment_intent_id ?? stripePaymentIntentId) as string | null;
  if (!pi) {
    throw new Error('Missing stripe_payment_intent_id; cannot create refund in Stripe.');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const refund = await stripe.refunds.create(
    { payment_intent: pi },
    { stripeAccount: env.STRIPE_CONNECT_DESTINATION_ACCOUNT_ID }
  );

  // Mark as processing; webhook can finalize to processed/succeeded.
  await supabase
    .from('refund_requests')
    .update({ status: 'processing', stripe_refund_id: refund.id })
    .eq('id', refundRequestId);

  if (payment?.id) {
    await supabase.from('payments').update({ status: 'refund_pending' }).eq('id', payment.id);
  }

  // Optional: revoke access immediately.
  if (payment?.user_id) {
    await supabase.from('profiles').update({ has_paid: false }).eq('id', payment.user_id);
    await supabase.auth.admin.updateUserById(payment.user_id, { user_metadata: { has_paid: false } });
  }

  redirect('/reembolsos');
}

export default async function ReembolsosPage() {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const { rows, paymentsById } = await getRefundQueue();
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <Nav />
      <div className="container">
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.2 }}>Reembolsos</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Lista de solicitacoes (refund_requests). Aprovar reembolso usa Stripe direct charge (stripeAccount: acct_...).
        </p>

        <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 12, color: 'rgba(209,213,219,0.75)' }}>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Solicitado</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Compra</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Dias</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Valor</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Status</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const payment = r.payment_id ? paymentsById.get(r.payment_id) : undefined;
                  const purchaseDate = payment?.created_at ? new Date(payment.created_at) : null;
                  const days = purchaseDate ? daysDiffCalendarSaoPaulo(purchaseDate, new Date()) : null;
                  const blocked = typeof days === 'number' ? days > 7 : false;

                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(55,65,81,0.25)' }}>
                      <td style={{ padding: 12 }} className="muted">
                        {new Date(r.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ padding: 12 }} className="muted">
                        {purchaseDate ? purchaseDate.toLocaleString('pt-BR') : '—'}
                      </td>
                      <td style={{ padding: 12 }}>
                        {days === null ? (
                          <span className="muted">—</span>
                        ) : (
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 900,
                              background: blocked ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.15)',
                              border: `1px solid ${blocked ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.3)'}`,
                              color: blocked ? 'rgb(252,165,165)' : 'rgb(134,239,172)',
                            }}
                          >
                            {days}d
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 12 }}>
                        {payment?.amount != null ? brl.format(payment.amount / 100) : '—'}
                      </td>
                      <td style={{ padding: 12 }} className="muted">
                        {r.status}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <form action={approveRefund}>
                          <input type="hidden" name="refund_request_id" value={r.id} />
                          <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={blocked || r.status !== 'pending'}
                            style={{ opacity: blocked || r.status !== 'pending' ? 0.5 : 1 }}
                          >
                            Aprovar
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td style={{ padding: 12 }} className="muted" colSpan={6}>
                      Nenhuma solicitacao encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
