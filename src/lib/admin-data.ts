import { getEnv } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase';

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  has_paid: boolean | null;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  user_id: string | null;
  stripe_session_id?: string | null;
  amount: number | null;
  amount_cents?: number | null;
  currency?: string | null;
  application_fee_cents?: number | null;
  refunded_amount_cents?: number | null;
  status: string | null;
  created_at: string | null;
  refunded_at?: string | null;
  refund_requested_at?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_refund_id?: string | null;
  customer_email?: string | null;
  connected_account_id?: string | null;
};

export type RefundRow = {
  id: string;
  user_id: string | null;
  payment_id: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_refund_id?: string | null;
  status: string | null;
  reason?: string | null;
  error_message?: string | null;
  created_at: string;
  processed_at?: string | null;
};

type FreeDiagnosticRow = {
  user_id: string;
  responses: Record<string, unknown> | null;
  recommended_visas: unknown;
  created_at: string;
  completed_at: string | null;
};

type DiagnosticSessionRow = {
  id: string;
  user_id: string;
  visa_type: string;
  status: string | null;
  created_at: string;
  completed_at?: string | null;
  updated_at?: string | null;
};

type ReportRow = {
  id: string;
  user_id: string;
  session_id?: string | null;
  visa_type: string;
  created_at: string;
  content: Record<string, unknown> | null;
};

export type AdminSnapshot = Awaited<ReturnType<typeof getAdminSnapshot>>;

function toMs(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

function isWithinDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(value).getTime() >= since;
}

function countDistinct(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function latestOf<T extends { created_at: string }>(rows: T[]) {
  return rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function getPaymentRefundState(payment: PaymentRow, refunds: RefundRow[]) {
  const linked = refunds.filter((refund) => refund.payment_id === payment.id);
  if (payment.status === 'refunded' || linked.some((refund) => refund.status === 'processed')) {
    return 'refunded' as const;
  }
  if (
    payment.status === 'refund_pending' ||
    linked.some((refund) => refund.status === 'pending' || refund.status === 'processing')
  ) {
    return 'refund_pending' as const;
  }
  return 'active' as const;
}

function getLatestEventDate(dates: Array<string | null | undefined>) {
  return dates
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null;
}

export function getPaymentConnectedAccountId(payment: PaymentRow | null | undefined) {
  const env = getEnv();
  return payment?.connected_account_id || env.STRIPE_CONNECT_DESTINATION_ACCOUNT_ID;
}

export function getPaymentAmountCents(payment: PaymentRow | null | undefined) {
  if (!payment) return 0;
  if (typeof payment.amount_cents === 'number') return payment.amount_cents;
  return payment.amount ?? 0;
}

export async function updateUserAccessFlag(userId: string) {
  const supabase = supabaseAdmin();
  const { data: payments } = await supabase
    .from('payments')
    .select('id,status')
    .eq('user_id', userId);

  const hasActivePayment = (payments ?? []).some((payment) => payment.status === 'completed');

  await supabase.from('profiles').update({ has_paid: hasActivePayment }).eq('id', userId);
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { has_paid: hasActivePayment },
  });
}

export async function getAdminSnapshot(periodDays = 30) {
  const supabase = supabaseAdmin();

  const [profilesRes, paymentsRes, refundsRes, freeDiagnosticsRes, sessionsRes, reportsRes] =
    await Promise.all([
      supabase.from('profiles').select('id,full_name,email,has_paid,created_at').limit(5000),
      supabase
        .from('payments')
        .select('*')
        .limit(5000),
      supabase
        .from('refund_requests')
        .select(
          'id,user_id,payment_id,stripe_payment_intent_id,stripe_refund_id,status,reason,error_message,created_at,processed_at'
        )
        .limit(5000),
      supabase
        .from('free_diagnostics')
        .select('user_id,responses,recommended_visas,created_at,completed_at')
        .limit(5000),
      supabase
        .from('diagnostic_sessions')
        .select('id,user_id,visa_type,status,created_at,completed_at,updated_at')
        .limit(5000),
      supabase.from('reports').select('id,user_id,session_id,visa_type,created_at,content').limit(5000),
    ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const refunds = (refundsRes.data ?? []) as RefundRow[];
  const freeDiagnostics = (freeDiagnosticsRes.data ?? []) as FreeDiagnosticRow[];
  const sessions = (sessionsRes.data ?? []) as DiagnosticSessionRow[];
  const reports = (reportsRes.data ?? []) as ReportRow[];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const paymentsByUser = new Map<string, PaymentRow[]>();
  const refundsByUser = new Map<string, RefundRow[]>();
  const sessionsByUser = new Map<string, DiagnosticSessionRow[]>();
  const freeByUser = new Map<string, FreeDiagnosticRow[]>();
  const reportsByUser = new Map<string, ReportRow[]>();

  for (const payment of payments) {
    if (!payment.user_id) continue;
    paymentsByUser.set(payment.user_id, [...(paymentsByUser.get(payment.user_id) ?? []), payment]);
  }
  for (const refund of refunds) {
    if (!refund.user_id) continue;
    refundsByUser.set(refund.user_id, [...(refundsByUser.get(refund.user_id) ?? []), refund]);
  }
  for (const session of sessions) {
    sessionsByUser.set(session.user_id, [...(sessionsByUser.get(session.user_id) ?? []), session]);
  }
  for (const free of freeDiagnostics) {
    freeByUser.set(free.user_id, [...(freeByUser.get(free.user_id) ?? []), free]);
  }
  for (const report of reports) {
    reportsByUser.set(report.user_id, [...(reportsByUser.get(report.user_id) ?? []), report]);
  }

  const activeCustomers = profiles.filter((profile) => {
    const userPayments = paymentsByUser.get(profile.id) ?? [];
    const userRefunds = refundsByUser.get(profile.id) ?? [];
    const hasActiveCompletedPayment = userPayments.some(
      (payment) => payment.status === 'completed' && getPaymentRefundState(payment, userRefunds) === 'active'
    );
    return profile.has_paid === true && hasActiveCompletedPayment;
  });

  const refundPendingUsers = profiles.filter((profile) => {
    const userPayments = paymentsByUser.get(profile.id) ?? [];
    const userRefunds = refundsByUser.get(profile.id) ?? [];
    return userPayments.some(
      (payment) =>
        payment.status === 'refund_pending' ||
        getPaymentRefundState(payment, userRefunds) === 'refund_pending'
    );
  });

  const refundedUsers = profiles.filter((profile) => {
    const userPayments = paymentsByUser.get(profile.id) ?? [];
    const userRefunds = refundsByUser.get(profile.id) ?? [];
    return userPayments.some(
      (payment) =>
        payment.status === 'refunded' || getPaymentRefundState(payment, userRefunds) === 'refunded'
    );
  });

  const leads = profiles.filter((profile) => !activeCustomers.some((customer) => customer.id === profile.id));

  const periodLeads = profiles.filter((profile) => isWithinDays(profile.created_at, periodDays));
  const completedPayments = payments.filter((payment) => payment.status === 'completed');
  const periodPayments = completedPayments.filter((payment) => isWithinDays(payment.created_at, periodDays));
  const refundPending = refunds.filter((refund) => refund.status === 'pending' || refund.status === 'processing');
  const refundProcessed = refunds.filter((refund) => refund.status === 'processed');
  const periodCustomers = new Set(periodPayments.map((payment) => payment.user_id).filter(Boolean));
  const periodFreeDiagnostics = new Set(
    freeDiagnostics
      .filter((item) => isWithinDays(item.completed_at ?? item.created_at, periodDays))
      .map((item) => item.user_id)
  );

  const totalRevenueCents = completedPayments.reduce((sum, payment) => sum + getPaymentAmountCents(payment), 0);
  const periodRevenueCents = periodPayments.reduce((sum, payment) => sum + getPaymentAmountCents(payment), 0);

  const freeCompletedUsers = new Set(
    freeDiagnostics.filter((item) => item.completed_at).map((item) => item.user_id)
  );
  const specificStartedUsers = new Set(sessions.map((session) => session.user_id));
  const reportUsers = new Set(reports.map((report) => report.user_id));
  const paidUsers = new Set(completedPayments.map((payment) => payment.user_id).filter(Boolean));

  const funnel = [
    { label: 'Leads cadastrados', value: profiles.length },
    { label: 'Diagnostico gratis concluido', value: freeCompletedUsers.size },
    { label: 'Formulario especifico iniciado', value: specificStartedUsers.size },
    { label: 'Pagamento concluido', value: paidUsers.size },
    { label: 'Relatorio gerado', value: reportUsers.size },
  ].map((step, index, list) => {
    const previous = index === 0 ? step.value : list[index - 1].value;
    const drop = previous > 0 ? ((previous - step.value) / previous) * 100 : 0;
    return {
      ...step,
      drop: index === 0 ? 0 : drop,
    };
  });

  const topObjectives = Array.from(
    freeDiagnostics.reduce((map, item) => {
      const value = item.responses?.objetivo;
      if (typeof value === 'string') map.set(value, (map.get(value) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const recommendedVisas = Array.from(
    freeDiagnostics.reduce((map, item) => {
      if (!Array.isArray(item.recommended_visas)) return map;
      for (const visa of item.recommended_visas) {
        if (typeof visa === 'string') map.set(visa, (map.get(visa) ?? 0) + 1);
      }
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const buildLeadRow = (profile: ProfileRow) => {
    const userPayments = paymentsByUser.get(profile.id) ?? [];
    const userRefunds = refundsByUser.get(profile.id) ?? [];
    const userSessions = sessionsByUser.get(profile.id) ?? [];
    const userFree = freeByUser.get(profile.id) ?? [];
    const userReports = reportsByUser.get(profile.id) ?? [];
    const latestPayment = latestOf(userPayments.filter((payment) => payment.created_at) as Array<PaymentRow & { created_at: string }>);
    const latestSession = latestOf(userSessions);
    const latestFree = latestOf(userFree.filter((item) => item.created_at));
    const latestReport = latestOf(userReports);
    const latestRefund = latestOf(userRefunds);

    const status = activeCustomers.some((customer) => customer.id === profile.id)
      ? 'ativo'
      : refundPendingUsers.some((item) => item.id === profile.id)
        ? 'refund_pendente'
        : refundedUsers.some((item) => item.id === profile.id)
          ? 'reembolsado'
          : 'lead';

    return {
      id: profile.id,
      name: profile.full_name || 'Sem nome',
      email: profile.email || 'Sem e-mail',
      createdAt: profile.created_at,
      status,
      hasFreeDiagnostic: userFree.some((item) => !!item.completed_at),
      hasSpecificStarted: userSessions.length > 0,
      latestVisaType: latestSession?.visa_type ?? latestReport?.visa_type ?? null,
      lastEventAt: getLatestEventDate([
        profile.created_at,
        latestFree?.completed_at ?? latestFree?.created_at,
        latestSession?.updated_at ?? latestSession?.created_at,
        latestPayment?.created_at,
        latestRefund?.processed_at ?? latestRefund?.created_at,
        latestReport?.created_at,
      ]),
      activePayment: latestPayment,
      refunds: userRefunds,
    };
  };

  const customerRows = activeCustomers.map(buildLeadRow);
  const leadRows = leads.map(buildLeadRow);

  return {
    counts: {
      profiles: profiles.length,
      payments: payments.length,
      refundRequests: refunds.length,
    },
    metrics: {
      leadsPeriod: periodLeads.length,
      activeCustomersNow: activeCustomers.length,
      customersPeriod: periodCustomers.size,
      completedSales: completedPayments.length,
      periodSales: periodPayments.length,
      revenueBrutaCents: totalRevenueCents,
      revenueBrutaPeriodCents: periodRevenueCents,
      refundPendingCount: refundPending.length,
      refundProcessedCount: refundProcessed.length,
      conversionLeadToCustomer: periodLeads.length ? (periodCustomers.size / periodLeads.length) * 100 : 0,
      conversionFreeToCustomer: periodFreeDiagnostics.size
        ? (periodCustomers.size / periodFreeDiagnostics.size) * 100
        : 0,
      refundRate: completedPayments.length ? (refundProcessed.length / completedPayments.length) * 100 : 0,
    },
    funnel,
    charts: {
      topObjectives,
      recommendedVisas,
    },
    customers: customerRows,
    leads: leadRows,
    raw: {
      profiles,
      payments,
      refunds,
      freeDiagnostics,
      sessions,
      reports,
      profileById,
    },
  };
}
