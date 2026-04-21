import Stripe from 'stripe';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatBusinessStatus, formatCurrencyBRL, formatDateTime } from '@/lib/admin-presenters';
import { getPaymentConnectedAccountId, updateUserAccessFlag } from '@/lib/admin-data';
import { getEnv } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function isNextRedirectError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

function saoPauloDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function daysDiffCalendarSaoPaulo(from: Date, to: Date) {
  const a = Date.parse(`${saoPauloDateKey(from)}T00:00:00Z`);
  const b = Date.parse(`${saoPauloDateKey(to)}T00:00:00Z`);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function buildFeedbackUrl(message: string, type: 'success' | 'error') {
  return `/reembolsos?${type}=${encodeURIComponent(message)}`;
}

async function getRefundQueue() {
  const supabase = supabaseAdmin();
  const { data: refundRequests, error } = await supabase
    .from('refund_requests')
    .select('*')
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
      ? supabase.from('payments').select('*').in('id', paymentIds)
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
    const rawStatus =
      payment?.status === 'refunded'
        ? 'processed'
        : payment?.status === 'refund_pending'
          ? 'processing'
          : row.status;

    return {
      id: row.id,
      leadId: row.user_id,
      customerName: profile?.full_name || 'Cliente sem nome',
      customerEmail: profile?.email || 'Sem e-mail',
      amount: payment?.amount ?? 0,
      status: formatBusinessStatus(rawStatus),
      purchaseDate: payment?.created_at ?? null,
      ageDays,
      isLate: typeof ageDays === 'number' ? ageDays > 7 : false,
      reason: row.reason || null,
      rawStatus,
      paymentStatus: payment?.status ?? null,
      errorMessage: row.error_message || null,
    };
  });

  return {
    rows,
    totals: {
      pending: rows.filter((row) => row.rawStatus === 'pending' || row.rawStatus === 'processing').length,
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
  if (!refundRequestId) redirect(buildFeedbackUrl('Pedido de reembolso invalido.', 'error'));

  const env = getEnv();
  const supabase = supabaseAdmin();

  let paymentId: string | null = null;

  try {
    const { data: refundRequest } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('id', refundRequestId)
      .maybeSingle();

    if (!refundRequest) {
      redirect(buildFeedbackUrl('Pedido de reembolso nao encontrado.', 'error'));
    }

    if (refundRequest.status === 'processed') {
      redirect(buildFeedbackUrl('Este reembolso ja foi concluido.', 'success'));
    }

    const { data: payment } = refundRequest.payment_id
      ? await supabase.from('payments').select('*').eq('id', refundRequest.payment_id).maybeSingle()
      : { data: null };

    if (!payment) {
      await supabase
        .from('refund_requests')
        .update({ status: 'failed', error_message: 'Pagamento vinculado nao encontrado.' })
        .eq('id', refundRequestId);
      redirect(buildFeedbackUrl('Pagamento vinculado nao encontrado.', 'error'));
    }

    paymentId = payment.id;

    if (payment.status === 'refunded') {
      await supabase
        .from('refund_requests')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          stripe_refund_id: refundRequest.stripe_refund_id ?? payment.stripe_refund_id ?? null,
        })
        .eq('id', refundRequestId);
      await updateUserAccessFlag(payment.user_id);
      redirect(buildFeedbackUrl('Pagamento ja estava reembolsado e foi reconciliado.', 'success'));
    }

    if (refundRequest.status === 'processing' || payment.status === 'refund_pending') {
      redirect(buildFeedbackUrl('Este reembolso ja esta em processamento.', 'success'));
    }

    const paymentCreatedAt = payment.created_at ? new Date(payment.created_at) : null;
    if (!paymentCreatedAt) {
      await supabase
        .from('refund_requests')
        .update({ status: 'failed', error_message: 'Data do pagamento invalida.' })
        .eq('id', refundRequestId);
      redirect(buildFeedbackUrl('Data do pagamento invalida.', 'error'));
    }

    if (daysDiffCalendarSaoPaulo(paymentCreatedAt, new Date()) > 7) {
      await supabase
        .from('refund_requests')
        .update({ status: 'failed', error_message: 'Prazo de 7 dias expirado.' })
        .eq('id', refundRequestId);
      redirect(buildFeedbackUrl('Pedido fora do prazo de 7 dias.', 'error'));
    }

    const paymentIntentId =
      payment.stripe_payment_intent_id ?? refundRequest.stripe_payment_intent_id ?? null;
    if (!paymentIntentId) {
      await supabase
        .from('refund_requests')
        .update({ status: 'failed', error_message: 'Pagamento sem payment intent.' })
        .eq('id', refundRequestId);
      redirect(buildFeedbackUrl('Pagamento sem identificador Stripe.', 'error'));
    }

    await supabase
      .from('refund_requests')
      .update({ status: 'processing', error_message: null })
      .eq('id', refundRequestId);

    await supabase.from('payments').update({ status: 'refund_pending' }).eq('id', payment.id);

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { stripeAccount: getPaymentConnectedAccountId(payment) }
    );

    if (refund.status === 'succeeded') {
      await supabase
        .from('payments')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          stripe_refund_id: refund.id,
        })
        .eq('id', payment.id);

      await supabase
        .from('refund_requests')
        .update({
          status: 'processed',
          stripe_refund_id: refund.id,
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', refundRequestId);

      await updateUserAccessFlag(payment.user_id);
    } else {
      await supabase
        .from('refund_requests')
        .update({
          status: 'processing',
          stripe_refund_id: refund.id,
          error_message: null,
        })
        .eq('id', refundRequestId);
    }

    revalidatePath('/');
    revalidatePath('/clientes');
    revalidatePath('/leads');
    revalidatePath('/pagamentos');
    revalidatePath('/reembolsos');
    revalidatePath(`/leads/${payment.user_id}`);

    redirect(buildFeedbackUrl('Reembolso enviado para a Stripe.', 'success'));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;

    const message = error instanceof Error ? error.message : 'Erro interno ao aprovar reembolso.';
    await supabase
      .from('refund_requests')
      .update({ status: 'failed', error_message: message })
      .eq('id', refundRequestId);

    if (paymentId) {
      await supabase.from('payments').update({ status: 'completed' }).eq('id', paymentId);
    }

    revalidatePath('/reembolsos');
    redirect(buildFeedbackUrl(message, 'error'));
  }
}

export default async function ReembolsosPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const sp = await searchParams;
  const data = await getRefundQueue();

  return (
    <>
      <Nav current="refunds" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Reembolsos</div>
          <div className="muted">A fila abaixo usa o Supabase como fonte de verdade.</div>
        </div>

        {sp.success ? <div className="card" style={{ borderColor: 'rgba(79, 209, 165, 0.25)' }}>{sp.success}</div> : null}
        {sp.error ? <div className="card" style={{ borderColor: 'rgba(255, 125, 125, 0.25)' }}>{sp.error}</div> : null}

        <div className="grid">
          <div className="col-4">
            <StatCard label="Pendentes" value={String(data.totals.pending)} />
          </div>
          <div className="col-4">
            <StatCard label="Concluidos" value={String(data.totals.approved)} />
          </div>
          <div className="col-4">
            <StatCard label="Falharam" value={String(data.totals.failed)} />
          </div>
        </div>

        <div className="card">
          <div className="section-title">Fila</div>
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
                    <td>{row.leadId ? <Link href={`/leads/${row.leadId}`} prefetch={false}>{row.customerName}</Link> : row.customerName}</td>
                    <td className="muted">{row.customerEmail}</td>
                    <td>{formatCurrencyBRL(row.amount / 100)}</td>
                    <td>{row.status}</td>
                    <td className="muted">{formatDateTime(row.purchaseDate)}</td>
                    <td>
                      {row.ageDays === null ? (
                        <span className="pill warn">Sem data</span>
                      ) : row.isLate ? (
                        <span className="pill danger">{row.ageDays} dias</span>
                      ) : (
                        <span className="pill success">{row.ageDays} dias</span>
                      )}
                    </td>
                    <td className="muted" style={{ maxWidth: 320 }}>
                      {row.errorMessage ? `${row.reason || 'Sem motivo'} | Erro: ${row.errorMessage}` : row.reason || 'Sem motivo informado'}
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
                    <td colSpan={8} className="muted">Nenhum pedido de reembolso cadastrado.</td>
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
