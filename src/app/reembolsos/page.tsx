import Stripe from 'stripe';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatBusinessStatus, formatCurrencyBRL, formatDateTime } from '@/lib/admin-presenters';
import { getEnv } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function saoPauloDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function daysDiffCalendarSaoPaulo(from: Date, to: Date) {
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
    .select('id,user_id,payment_id,stripe_payment_intent_id,stripe_refund_id,reason,status,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Failed to load refund_requests:', error);
    return { rows: [], totals: { pending: 0, approved: 0, failed: 0 } };
  }

  const paymentIds = (refundRequests ?? []).map((row) => row.payment_id).filter(Boolean);
  const userIds = (refundRequests ?? []).map((row) => row.user_id).filter(Boolean);

  const [paymentsRes, profilesRes] = await Promise.all([
    paymentIds.length
      ? supabase
          .from('payments')
          .select('id,user_id,amount,status,created_at,stripe_payment_intent_id')
          .in('id', paymentIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from('profiles').select('id,full_name,email').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const paymentsById = new Map((paymentsRes.data ?? []).map((payment) => [payment.id, payment]));
  const profilesById = new Map((profilesRes.data ?? []).map((profile) => [profile.id, profile]));

  const rows = (refundRequests ?? []).map((row) => {
    const payment = row.payment_id ? paymentsById.get(row.payment_id) : null;
    const profile = row.user_id ? profilesById.get(row.user_id) : null;
    const purchaseDate = payment?.created_at ? new Date(payment.created_at) : null;
    const ageDays = purchaseDate ? daysDiffCalendarSaoPaulo(purchaseDate, new Date()) : null;

    return {
      id: row.id,
      leadId: row.user_id,
      customerName: profile?.full_name || 'Cliente sem nome',
      customerEmail: profile?.email || 'Sem e-mail',
      amount: payment?.amount ?? 0,
      status: formatBusinessStatus(row.status),
      createdAt: row.created_at,
      purchaseDate: payment?.created_at ?? null,
      ageDays,
      isLate: typeof ageDays === 'number' ? ageDays > 7 : false,
      reason: row.reason || null,
      paymentIntentId: row.stripe_payment_intent_id ?? payment?.stripe_payment_intent_id ?? null,
      rawStatus: row.status,
    };
  });

  return {
    rows,
    totals: {
      pending: rows.filter((row) => row.rawStatus === 'pending').length,
      approved: rows.filter((row) => row.rawStatus === 'processed').length,
      failed: rows.filter((row) => row.rawStatus === 'failed').length,
    },
  };
}

async function approveRefund(formData: FormData) {
  'use server';

  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const refundRequestId = String(formData.get('refund_request_id') ?? '').trim();
  if (!refundRequestId) redirect('/reembolsos');

  const env = getEnv();
  const supabase = supabaseAdmin();
  const { data: refundRequest } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('id', refundRequestId)
    .maybeSingle();

  if (!refundRequest) redirect('/reembolsos');

  let payment = null;
  if (refundRequest.payment_id) {
    const { data } = await supabase.from('payments').select('*').eq('id', refundRequest.payment_id).maybeSingle();
    payment = data;
  }

  const paymentCreatedAt = payment?.created_at ? new Date(payment.created_at) : null;
  if (!paymentCreatedAt) {
    throw new Error('Nao foi possivel localizar a data da compra para validar o prazo de reembolso.');
  }

  const diffDays = daysDiffCalendarSaoPaulo(paymentCreatedAt, new Date());
  if (diffDays > 7) {
    throw new Error('Este pedido passou do prazo de 7 dias corridos no calendario.');
  }

  const paymentIntentId =
    payment?.stripe_payment_intent_id ?? refundRequest.stripe_payment_intent_id ?? null;
  if (!paymentIntentId) {
    throw new Error('Nao foi encontrado o pagamento para realizar o reembolso.');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { stripeAccount: env.STRIPE_CONNECT_DESTINATION_ACCOUNT_ID }
  );

  await supabase
    .from('refund_requests')
    .update({ status: 'processing', stripe_refund_id: refund.id })
    .eq('id', refundRequestId);

  if (payment?.id) {
    await supabase.from('payments').update({ status: 'refund_pending' }).eq('id', payment.id);
  }

  if (payment?.user_id) {
    await supabase.from('profiles').update({ has_paid: false }).eq('id', payment.user_id);
    await supabase.auth.admin.updateUserById(payment.user_id, { user_metadata: { has_paid: false } });
  }

  redirect('/reembolsos');
}

export default async function ReembolsosPage() {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const data = await getRefundQueue();

  return (
    <>
      <Nav current="refunds" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Reembolsos</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
            Controle quem pediu devolucao e o que ainda pode ser aprovado.
          </h1>
          <p className="muted" style={{ marginTop: 14, maxWidth: 740, fontSize: 17 }}>
            O painel calcula automaticamente a idade da compra em dias de calendario para evitar
            aprovar pedidos fora da janela de 7 dias.
          </p>
        </div>

        <div className="grid">
          <div className="col-4">
            <StatCard label="Aguardando analise" value={String(data.totals.pending)} />
          </div>
          <div className="col-4">
            <StatCard label="Reembolsos concluidos" value={String(data.totals.approved)} />
          </div>
          <div className="col-4">
            <StatCard label="Pedidos com falha" value={String(data.totals.failed)} />
          </div>
        </div>

        <div className="card">
          <div className="section-title">Fila de reembolso</div>
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Compra</th>
                  <th>Prazo</th>
                  <th>Motivo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.leadId ? (
                        <Link href={`/leads/${row.leadId}`} prefetch={false}>
                          {row.customerName}
                        </Link>
                      ) : (
                        row.customerName
                      )}
                    </td>
                    <td className="muted">{row.customerEmail}</td>
                    <td>{formatCurrencyBRL(row.amount / 100)}</td>
                    <td>{row.status}</td>
                    <td className="muted">{formatDateTime(row.purchaseDate)}</td>
                    <td>
                      {row.ageDays === null ? (
                        <span className="pill warn">Sem data</span>
                      ) : row.isLate ? (
                        <span className="pill danger">{row.ageDays} dias - fora do prazo</span>
                      ) : (
                        <span className="pill success">{row.ageDays} dias - dentro do prazo</span>
                      )}
                    </td>
                    <td className="muted" style={{ maxWidth: 320 }}>
                      {row.reason || 'Sem motivo informado'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <form action={approveRefund}>
                        <input type="hidden" name="refund_request_id" value={row.id} />
                        <button
                          className="btn btn-primary"
                          type="submit"
                          disabled={row.isLate || row.rawStatus !== 'pending'}
                          style={{ opacity: row.isLate || row.rawStatus !== 'pending' ? 0.45 : 1 }}
                        >
                          Aprovar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      Ainda nao existem pedidos de reembolso cadastrados.
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

