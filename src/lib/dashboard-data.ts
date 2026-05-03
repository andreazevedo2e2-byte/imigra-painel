import { supabaseAdmin } from '@/lib/supabase';
import {
  formatBusinessStatus,
  getIncomeMidpoint,
  normalizeRecommendedVisas,
} from '@/lib/admin-presenters';

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  has_paid: boolean | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  user_id: string | null;
  amount: number | null;
  amount_cents?: number | null;
  currency?: string | null;
  status: string | null;
  created_at: string | null;
};

type RefundRow = {
  id: string;
  user_id: string | null;
  payment_id: string | null;
  status: string | null;
  created_at: string;
};

type FreeDiagnosticRow = {
  user_id: string;
  responses: Record<string, unknown> | null;
  recommended_visas: unknown;
  created_at: string;
  completed_at: string | null;
};

type DiagnosticSessionRow = {
  user_id: string;
  visa_type: string;
  status: string | null;
  created_at: string;
};

type ReportRow = {
  user_id: string;
  visa_type: string;
  created_at: string;
  content: Record<string, unknown> | null;
};

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

function countBy<T extends string>(values: T[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function percentage(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function startOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getDashboardData() {
  const supabase = supabaseAdmin();

  const [
    profilesRes,
    paymentsRes,
    refundsRes,
    freeDiagnosticsRes,
    sessionsRes,
    reportsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,has_paid,created_at').limit(5000),
    supabase.from('payments').select('id,user_id,amount,status,created_at').limit(5000),
    supabase.from('refund_requests').select('id,user_id,payment_id,status,created_at').limit(5000),
    supabase
      .from('free_diagnostics')
      .select('user_id,responses,recommended_visas,created_at,completed_at')
      .limit(5000),
    supabase.from('diagnostic_sessions').select('user_id,visa_type,status,created_at').limit(5000),
    supabase.from('reports').select('user_id,visa_type,created_at,content').limit(5000),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const refunds = (refundsRes.data ?? []) as RefundRow[];
  const freeDiagnostics = (freeDiagnosticsRes.data ?? []) as FreeDiagnosticRow[];
  const sessions = (sessionsRes.data ?? []) as DiagnosticSessionRow[];
  const reports = (reportsRes.data ?? []) as ReportRow[];

  const completedPayments = payments.filter((payment) => payment.status === 'completed');
  const paidUsers = new Set(completedPayments.map((payment) => payment.user_id).filter(Boolean));
  const refundRequests = refunds.filter((refund) => refund.status !== 'failed');
  const refundedPayments = payments.filter((payment) => payment.status === 'refunded');

  const totalRevenueCents = completedPayments.reduce(
    (sum, payment) => sum + (payment.amount_cents ?? payment.amount ?? 0),
    0
  );
  const monthStartIso = startOfMonthIso();
  const monthRevenueCents = completedPayments
    .filter((payment) => payment.created_at && payment.created_at >= monthStartIso)
    .reduce((sum, payment) => sum + (payment.amount_cents ?? payment.amount ?? 0), 0);

  const latestFreeByUser = new Map<string, FreeDiagnosticRow>();
  for (const row of freeDiagnostics) {
    const current = latestFreeByUser.get(row.user_id);
    if (!current || current.created_at < row.created_at) latestFreeByUser.set(row.user_id, row);
  }

  const averageIncome = Array.from(latestFreeByUser.values())
    .map((row) => getIncomeMidpoint(row.responses?.income_range))
    .filter((value): value is number => value !== null);

  const incomeAverage = averageIncome.length
    ? averageIncome.reduce((sum, value) => sum + value, 0) / averageIncome.length
    : 0;

  const ageDistribution = countBy(
    Array.from(latestFreeByUser.values())
      .map((row) => {
        const age = row.responses?.age_range;
        return typeof age === 'string' ? age : null;
      })
      .filter(Boolean) as string[]
  );

  const incomeDistribution = countBy(
    Array.from(latestFreeByUser.values())
      .map((row) => {
        const income = row.responses?.income_range;
        return typeof income === 'string' ? income : null;
      })
      .filter(Boolean) as string[]
  );

  const topObjectives = countBy(
    Array.from(latestFreeByUser.values())
      .map((row) => {
        const objective = row.responses?.objetivo;
        return typeof objective === 'string' ? objective : null;
      })
      .filter(Boolean) as string[]
  );

  const recommendedVisas = countBy(
    Array.from(latestFreeByUser.values())
      .map((row) => normalizeRecommendedVisas(row.recommended_visas)[0])
      .filter(Boolean) as string[]
  );

  const reportsByVisa = countBy(reports.map((report) => report.visa_type));
  const sessionsByVisa = countBy(sessions.map((session) => session.visa_type));

  const recentLeads = profiles
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6)
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name || 'Lead sem nome',
      email: profile.email || 'Sem e-mail',
      paid: profile.has_paid === true,
      createdAt: profile.created_at,
    }));

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const recentSales = completedPayments
    .slice()
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 8)
    .map((payment) => {
      const profile = payment.user_id ? profileMap.get(payment.user_id) : null;
      return {
        id: payment.id,
        customerName: profile?.full_name || 'Cliente sem nome',
        customerEmail: profile?.email || 'Sem e-mail',
        amount: payment.amount ?? 0,
        createdAt: payment.created_at,
        status: formatBusinessStatus(payment.status),
      };
    });

  const funnel = [
    { label: 'Leads cadastrados', value: profiles.length },
    { label: 'Diagnostico gratuito concluido', value: latestFreeByUser.size },
    { label: 'Diagnostico completo iniciado', value: new Set(sessions.map((session) => session.user_id)).size },
    { label: 'Relatorios gerados', value: new Set(reports.map((report) => report.user_id)).size },
    { label: 'Clientes pagantes', value: paidUsers.size },
    { label: 'Pedidos de reembolso', value: refundRequests.length },
  ];

  return {
    totals: {
      leads: profiles.length,
      payingClients: paidUsers.size,
      sales: completedPayments.length,
      refundRequests: refundRequests.length,
      refundedSales: refundedPayments.length,
      totalRevenueCents,
      monthRevenueCents,
      averageTicketCents: completedPayments.length ? totalRevenueCents / completedPayments.length : 0,
      conversionRate: percentage(paidUsers.size, profiles.length),
      refundRate: percentage(refundRequests.length, completedPayments.length),
      averageIncomeReais: incomeAverage,
    },
    charts: {
      ageDistribution,
      incomeDistribution,
      topObjectives,
      recommendedVisas,
      reportsByVisa,
      sessionsByVisa,
      funnel,
    },
    recent: {
      leads: recentLeads,
      sales: recentSales,
    },
  };
}
