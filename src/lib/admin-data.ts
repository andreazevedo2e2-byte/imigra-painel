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

type AnalyticsEventRow = {
  id: string;
  created_at: string;
  event_type: 'page_view' | 'scroll_depth' | 'cta_click' | string;
  session_id: string | null;
  user_id: string | null;
  path: string | null;
  referrer?: string | null;
  title?: string | null;
  scroll_depth?: number | null;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AdminSnapshot = Awaited<ReturnType<typeof getAdminSnapshot>>;

type DailyPoint = { date: string; value: number };

function toMs(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDayMs(inputMs: number) {
  const d = new Date(inputMs);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function toUtcDayKey(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildDayKeys(endDayMs: number, days: number) {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    keys.push(new Date(endDayMs - i * DAY_MS).toISOString().slice(0, 10));
  }
  return keys;
}

function seriesFromMap(keys: string[], map: Map<string, number>): DailyPoint[] {
  return keys.map((date) => ({ date, value: map.get(date) ?? 0 }));
}

function sumSeries(points: DailyPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0);
}

function deltaPercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function isWithinDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  if (days <= 0) return true;
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(value).getTime() >= since;
}

function countDistinct(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function pushTopItem(map: Map<string, number>, label: string | null | undefined, amount = 1) {
  const clean = label?.replace(/\s+/g, ' ').trim();
  if (!clean) return;
  map.set(clean, (map.get(clean) ?? 0) + amount);
}

function toTopItems(map: Map<string, number>, limit = 8) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  group: string,
  key: string
) {
  const nested = metadata?.[group];
  if (!nested || typeof nested !== 'object' || !(key in nested)) return null;
  const value = (nested as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readMetadataTopLevelString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getDeviceLabel(metadata: Record<string, unknown> | null | undefined) {
  const raw =
    readMetadataTopLevelString(metadata, 'device_type') ??
    readMetadataTopLevelString(metadata, 'device') ??
    '';
  const value = raw.toLowerCase();

  if (value === 'mobile' || value === 'celular') return 'Celular';
  if (value === 'tablet') return 'Tablet';
  if (value === 'desktop' || value === 'notebook') return 'Desktop / notebook';
  return 'Nao identificado';
}

function getAnalyticsPathname(path: string | null | undefined) {
  if (!path) return '/';
  try {
    return new URL(path, 'https://imigraplan.local').pathname;
  } catch {
    return path.split('?')[0] || '/';
  }
}

function isTrackedLandingEvent(event: AnalyticsEventRow) {
  return getAnalyticsPathname(event.path) === '/';
}

function isCheckoutStartedEvent(event: AnalyticsEventRow) {
  return event.event_type === 'checkout_started';
}

function latestOf<T extends { created_at: string }>(rows: T[]) {
  return rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function sortRowsByRecency<T extends { lastEventAt: string | null; createdAt: string }>(rows: T[]) {
  return rows
    .slice()
    .sort(
      (a, b) =>
        toMs(b.lastEventAt ?? b.createdAt) - toMs(a.lastEventAt ?? a.createdAt)
    );
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

export async function setUserAccessFlag(userId: string, hasPaid: boolean) {
  const supabase = supabaseAdmin();
  await supabase.from('profiles').update({ has_paid: hasPaid }).eq('id', userId);
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { has_paid: hasPaid },
  });
}

export async function getAdminSnapshot(periodDays = 30) {
  const supabase = supabaseAdmin();

  const [profilesRes, paymentsRes, refundsRes, freeDiagnosticsRes, sessionsRes, reportsRes, analyticsRes] =
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
      supabase
        .from('analytics_events')
        .select('id,created_at,event_type,session_id,user_id,path,referrer,title,scroll_depth,target,metadata')
        .limit(20000),
    ]);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const refunds = (refundsRes.data ?? []) as RefundRow[];
  const freeDiagnostics = (freeDiagnosticsRes.data ?? []) as FreeDiagnosticRow[];
  const sessions = (sessionsRes.data ?? []) as DiagnosticSessionRow[];
  const reports = (reportsRes.data ?? []) as ReportRow[];
  const analyticsEvents = (analyticsRes.data ?? []) as AnalyticsEventRow[];

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

  const latestFreeByUser = new Map<string, FreeDiagnosticRow>();
  for (const row of freeDiagnostics) {
    const existing = latestFreeByUser.get(row.user_id);
    const rowMs = toMs(row.completed_at ?? row.created_at);
    const existingMs = existing ? toMs(existing.completed_at ?? existing.created_at) : -1;
    if (!existing || rowMs > existingMs) latestFreeByUser.set(row.user_id, row);
  }

  const latestFreeRows = Array.from(latestFreeByUser.values());

  const topObjectives = Array.from(
    latestFreeRows.reduce((map, item) => {
      const value = item.responses?.objetivo;
      if (typeof value === 'string') map.set(value, (map.get(value) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const incomeRanges = Array.from(
    latestFreeRows.reduce((map, item) => {
      const value = item.responses?.income_range;
      if (typeof value === 'string') map.set(value, (map.get(value) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const recommendedVisas = Array.from(
    latestFreeRows.reduce((map, item) => {
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

    const hasActiveCompletedPayment = userPayments.some(
      (payment) => payment.status === 'completed' && getPaymentRefundState(payment, userRefunds) === 'active'
    );
    const hasRefundPending = userPayments.some(
      (payment) => payment.status === 'refund_pending' || getPaymentRefundState(payment, userRefunds) === 'refund_pending'
    );
    const hasRefunded = userPayments.some(
      (payment) => payment.status === 'refunded' || getPaymentRefundState(payment, userRefunds) === 'refunded'
    );

    // Important: keep refunded/pending customers out of the "Leads" bucket.
    const status = hasActiveCompletedPayment
      ? 'ativo'
      : hasRefundPending
        ? 'refund_pendente'
        : hasRefunded
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

  const allRows = sortRowsByRecency(profiles.map(buildLeadRow));
  const customerRows = sortRowsByRecency(allRows.filter((row) => row.status === 'ativo'));
  const refundPendingCustomers = sortRowsByRecency(
    allRows.filter((row) => row.status === 'refund_pendente')
  );
  const refundedCustomers = sortRowsByRecency(
    allRows.filter((row) => row.status === 'reembolsado')
  );
  const leadRows = sortRowsByRecency(allRows.filter((row) => row.status === 'lead'));

  const currentEndDayMs = startOfUtcDayMs(Date.now());
  const knownDateMs = [
    ...profiles.map((row) => row.created_at),
    ...payments.map((row) => row.created_at),
    ...refunds.map((row) => row.created_at),
    ...freeDiagnostics.map((row) => row.created_at),
    ...sessions.map((row) => row.created_at),
    ...reports.map((row) => row.created_at),
    ...analyticsEvents.map((row) => row.created_at),
  ]
    .map(toMs)
    .filter((value) => Number.isFinite(value) && value > 0);
  const firstKnownDayMs = knownDateMs.length
    ? startOfUtcDayMs(Math.min(...knownDateMs))
    : currentEndDayMs;
  const allPeriodDays = Math.max(1, Math.round((currentEndDayMs - firstKnownDayMs) / DAY_MS) + 1);
  const chartPeriodDays = periodDays > 0 ? periodDays : allPeriodDays;
  const currentKeys = buildDayKeys(currentEndDayMs, chartPeriodDays);
  const previousEndDayMs = currentEndDayMs - chartPeriodDays * DAY_MS;
  const previousKeys = periodDays > 0 ? buildDayKeys(previousEndDayMs, chartPeriodDays) : [];

  const revenueByDay = new Map<string, number>();
  const salesByDay = new Map<string, number>();

  for (const payment of completedPayments) {
    const key = toUtcDayKey(payment.created_at);
    if (!key) continue;
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + getPaymentAmountCents(payment));
    salesByDay.set(key, (salesByDay.get(key) ?? 0) + 1);
  }

  const leadsByDay = new Map<string, number>();
  for (const profile of profiles) {
    const key = toUtcDayKey(profile.created_at);
    if (!key) continue;
    leadsByDay.set(key, (leadsByDay.get(key) ?? 0) + 1);
  }

  const firstPaidByUser = new Map<string, string>();
  for (const payment of completedPayments) {
    if (!payment.user_id) continue;
    if (!payment.created_at) continue;
    const existing = firstPaidByUser.get(payment.user_id);
    if (!existing || payment.created_at < existing) firstPaidByUser.set(payment.user_id, payment.created_at);
  }
  const newCustomersByDay = new Map<string, number>();
  for (const [, paidAt] of firstPaidByUser) {
    const key = toUtcDayKey(paidAt);
    if (!key) continue;
    newCustomersByDay.set(key, (newCustomersByDay.get(key) ?? 0) + 1);
  }

  const refundsProcessedByDay = new Map<string, number>();
  for (const refund of refundProcessed) {
    const key = toUtcDayKey(refund.processed_at ?? refund.created_at);
    if (!key) continue;
    refundsProcessedByDay.set(key, (refundsProcessedByDay.get(key) ?? 0) + 1);
  }

  const analyticsByDay = new Map<string, number>();
  const analyticsVisitorSetsByDay = new Map<string, Set<string>>();
  const trackedAnalyticsEvents = analyticsEvents.filter(isTrackedLandingEvent);
  const checkoutAnalyticsEvents = analyticsEvents.filter(isCheckoutStartedEvent);
  const periodAnalytics = trackedAnalyticsEvents.filter((event) => isWithinDays(event.created_at, periodDays));
  const periodCheckoutEvents = checkoutAnalyticsEvents.filter((event) =>
    isWithinDays(event.created_at, periodDays)
  );
  const periodPageViews = periodAnalytics.filter((event) => event.event_type === 'page_view');
  const periodClicks = periodAnalytics.filter((event) => event.event_type === 'cta_click');
  const periodScrolls = periodAnalytics.filter((event) => event.event_type === 'scroll_depth');
  const pathMap = new Map<string, number>();
  const clickMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const regionMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const maxScrollByVisit = new Map<string, number>();

  for (const event of trackedAnalyticsEvents) {
    const key = toUtcDayKey(event.created_at);
    if (!key) continue;
    if (event.event_type === 'page_view') {
      analyticsByDay.set(key, (analyticsByDay.get(key) ?? 0) + 1);
      if (event.session_id) {
        const set = analyticsVisitorSetsByDay.get(key) ?? new Set<string>();
        set.add(event.session_id);
        analyticsVisitorSetsByDay.set(key, set);
      }
    }
  }

  const firstPageViewBySession = new Map<string, AnalyticsEventRow>();
  for (const event of periodPageViews) {
    if (!event.session_id) continue;
    const existing = firstPageViewBySession.get(event.session_id);
    if (!existing || toMs(event.created_at) < toMs(existing.created_at)) {
      firstPageViewBySession.set(event.session_id, event);
    }
  }

  for (const event of Array.from(firstPageViewBySession.values())) {
    pushTopItem(pathMap, getAnalyticsPathname(event.path));
    const referrer = event.referrer && !event.referrer.includes('imigraplan.vercel.app')
      ? event.referrer
      : 'Direto / interno';
    pushTopItem(referrerMap, referrer);
    pushTopItem(deviceMap, getDeviceLabel(event.metadata));
    const country = readMetadataString(event.metadata, 'geo', 'country') ?? 'unknown';
    const region = readMetadataString(event.metadata, 'geo', 'region');
    const city = readMetadataString(event.metadata, 'geo', 'city');
    pushTopItem(countryMap, country === 'unknown' ? 'Pais nao identificado' : country);
    pushTopItem(regionMap, region ?? 'Regiao nao identificada');
    pushTopItem(cityMap, city ?? 'Cidade nao identificada');
  }

  const clickedSessionsByCta = new Map<string, Set<string>>();
  for (const event of periodClicks) {
    if (!event.session_id) continue;
    const target = event.target || 'CTA sem nome';
    const set = clickedSessionsByCta.get(target) ?? new Set<string>();
    set.add(event.session_id);
    clickedSessionsByCta.set(target, set);
  }
  for (const [target, sessions] of clickedSessionsByCta) {
    pushTopItem(clickMap, target, sessions.size);
  }

  for (const event of periodScrolls) {
    if (!event.session_id || !event.path || typeof event.scroll_depth !== 'number') continue;
    const key = `${event.session_id}:${event.path}`;
    maxScrollByVisit.set(key, Math.max(maxScrollByVisit.get(key) ?? 0, event.scroll_depth));
  }

  const scrollDepthValues = Array.from(maxScrollByVisit.values());
  const avgScrollDepth = scrollDepthValues.length
    ? scrollDepthValues.reduce((sum, value) => sum + value, 0) / scrollDepthValues.length
    : 0;

  const analyticsVisitorsByDay = new Map<string, number>();
  for (const [key, visitors] of analyticsVisitorSetsByDay) {
    analyticsVisitorsByDay.set(key, visitors.size);
  }

  const paidUserIds = new Set(completedPayments.map((payment) => payment.user_id).filter(Boolean));
  const eventsBySession = new Map<string, AnalyticsEventRow[]>();
  for (const event of periodAnalytics) {
    if (!event.session_id) continue;
    eventsBySession.set(event.session_id, [...(eventsBySession.get(event.session_id) ?? []), event]);
  }

  const hotLeads = Array.from(eventsBySession.entries())
    .map(([sessionId, events]) => {
      const sorted = events.slice().sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
      const userId = sorted.find((event) => event.user_id)?.user_id ?? null;
      if (userId && paidUserIds.has(userId)) return null;

      let score = 0;
      const paths = new Set(sorted.map((event) => event.path ?? ''));
      const clickedPayment = sorted.some((event) => {
        const target = `${event.target ?? ''}`.toLowerCase();
        return event.event_type === 'cta_click' && /diagnostico gratis|entrar|precos|como funciona/.test(target);
      });
      if (Array.from(paths).some((path) => getAnalyticsPathname(path) === '/')) score += 20;
      if (clickedPayment) score += 25;
      if (sorted.some((event) => event.event_type === 'scroll_depth' && (event.scroll_depth ?? 0) >= 75)) score += 10;
      if (score <= 0) return null;

      const profile = userId ? profileById.get(userId) : null;
      const last = sorted[sorted.length - 1];
      return {
        sessionId,
        userId,
        name: profile?.full_name || 'Visitante anonimo',
        email: profile?.email || '-',
        score: Math.min(score, 100),
        lastPath: last.path || '-',
        lastEventAt: last.created_at,
        country: readMetadataString(last.metadata, 'geo', 'country') ?? 'Pais nao identificado',
        city: readMetadataString(last.metadata, 'geo', 'city') ?? null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score || toMs(b!.lastEventAt) - toMs(a!.lastEventAt))
    .slice(0, 25) as Array<{
      sessionId: string;
      userId: string | null;
      name: string;
      email: string;
      score: number;
      lastPath: string;
      lastEventAt: string;
      country: string;
      city: string | null;
    }>;

  const abandonmentViews = new Map<string, number>();
  const abandonmentExits = new Map<string, number>();
  for (const event of periodPageViews) {
    pushTopItem(abandonmentViews, event.path || '/');
  }
  for (const [, events] of eventsBySession) {
    const pages = events
      .filter((event) => event.event_type === 'page_view')
      .sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
    const lastPage = pages[pages.length - 1];
    if (lastPage?.path) pushTopItem(abandonmentExits, lastPage.path);
  }
  const abandonment = Array.from(abandonmentViews.entries())
    .map(([path, views]) => {
      const exits = abandonmentExits.get(path) ?? 0;
      return {
        path,
        views,
        exits,
        rate: views > 0 ? (exits / views) * 100 : 0,
      };
    })
    .sort((a, b) => b.exits - a.exits || b.rate - a.rate)
    .slice(0, 12);

  const convertedCheckoutSessionIds = new Set(
    payments
      .filter((payment) =>
        !!payment.stripe_session_id &&
        ['completed', 'refund_pending', 'refunded'].includes(payment.status ?? '')
      )
      .map((payment) => payment.stripe_session_id!)
  );

  const checkoutGraceWindowMs = 15 * 60 * 1000;
  const nowMs = Date.now();
  const checkoutStartedByDay = new Map<string, number>();
  const checkoutAbandonedByDay = new Map<string, number>();

  type CheckoutAbandonmentRow = {
    sessionId: string;
    userId: string | null;
    name: string;
    email: string;
    startedAt: string;
    ageMinutes: number;
    lastIntent: string;
  };

  const checkoutAbandonedRows = periodCheckoutEvents
    .map((event) => {
      const stripeSessionId =
        readMetadataTopLevelString(event.metadata, 'stripe_session_id') ?? event.session_id ?? event.id;
      const createdMs = toMs(event.created_at);
      const ageMinutes = Math.max(0, Math.round((nowMs - createdMs) / (60 * 1000)));
      const hasConverted = convertedCheckoutSessionIds.has(stripeSessionId);
      const insideGraceWindow = nowMs - createdMs < checkoutGraceWindowMs;
      const profile = event.user_id ? profileById.get(event.user_id) : null;
      const nextPath = readMetadataTopLevelString(event.metadata, 'next_path');

      const dayKey = toUtcDayKey(event.created_at);
      if (dayKey) {
        checkoutStartedByDay.set(dayKey, (checkoutStartedByDay.get(dayKey) ?? 0) + 1);
        if (!hasConverted && !insideGraceWindow) {
          checkoutAbandonedByDay.set(dayKey, (checkoutAbandonedByDay.get(dayKey) ?? 0) + 1);
        }
      }

      if (hasConverted || insideGraceWindow) return null;

      return {
        sessionId: stripeSessionId,
        userId: event.user_id ?? null,
        name: profile?.full_name || 'Usuario identificado',
        email: profile?.email || '-',
        startedAt: event.created_at,
        ageMinutes,
        lastIntent: nextPath || '/diagnostico',
      } satisfies CheckoutAbandonmentRow;
    })
    .filter(Boolean)
    .sort((a, b) => toMs(b!.startedAt) - toMs(a!.startedAt)) as CheckoutAbandonmentRow[];

  const revenueCurrent = seriesFromMap(currentKeys, revenueByDay);
  const revenuePrevious = seriesFromMap(previousKeys, revenueByDay);
  const salesCurrent = seriesFromMap(currentKeys, salesByDay);
  const salesPrevious = seriesFromMap(previousKeys, salesByDay);
  const leadsCurrent = seriesFromMap(currentKeys, leadsByDay);
  const leadsPrevious = seriesFromMap(previousKeys, leadsByDay);
  const newCustomersCurrent = seriesFromMap(currentKeys, newCustomersByDay);
  const newCustomersPrevious = seriesFromMap(previousKeys, newCustomersByDay);
  const refundsCurrent = seriesFromMap(currentKeys, refundsProcessedByDay);
  const refundsPrevious = seriesFromMap(previousKeys, refundsProcessedByDay);
  const pageViewsCurrent = seriesFromMap(currentKeys, analyticsByDay);
  const pageViewsPrevious = seriesFromMap(previousKeys, analyticsByDay);
  const visitorsCurrent = seriesFromMap(currentKeys, analyticsVisitorsByDay);
  const visitorsPrevious = seriesFromMap(previousKeys, analyticsVisitorsByDay);
  const checkoutStartedCurrent = seriesFromMap(currentKeys, checkoutStartedByDay);
  const checkoutStartedPrevious = seriesFromMap(previousKeys, checkoutStartedByDay);
  const checkoutAbandonedCurrent = seriesFromMap(currentKeys, checkoutAbandonedByDay);
  const checkoutAbandonedPrevious = seriesFromMap(previousKeys, checkoutAbandonedByDay);

  const revenueCurrentTotal = sumSeries(revenueCurrent);
  const revenuePreviousTotal = sumSeries(revenuePrevious);
  const salesCurrentTotal = sumSeries(salesCurrent);
  const salesPreviousTotal = sumSeries(salesPrevious);
  const leadsCurrentTotal = sumSeries(leadsCurrent);
  const leadsPreviousTotal = sumSeries(leadsPrevious);
  const newCustomersCurrentTotal = sumSeries(newCustomersCurrent);
  const newCustomersPreviousTotal = sumSeries(newCustomersPrevious);
  const refundsCurrentTotal = sumSeries(refundsCurrent);
  const refundsPreviousTotal = sumSeries(refundsPrevious);
  const pageViewsCurrentTotal = sumSeries(pageViewsCurrent);
  const pageViewsPreviousTotal = sumSeries(pageViewsPrevious);
  const visitorsCurrentTotal = sumSeries(visitorsCurrent);
  const visitorsPreviousTotal = sumSeries(visitorsPrevious);
  const checkoutStartedCurrentTotal = sumSeries(checkoutStartedCurrent);
  const checkoutStartedPreviousTotal = sumSeries(checkoutStartedPrevious);
  const checkoutAbandonedCurrentTotal = sumSeries(checkoutAbandonedCurrent);
  const checkoutAbandonedPreviousTotal = sumSeries(checkoutAbandonedPrevious);

  return {
    counts: {
      profiles: profiles.length,
      payments: payments.length,
      refundRequests: refunds.length,
    },
    metrics: {
      leadsPeriod: periodLeads.length,
      activeCustomersNow: customerRows.length,
      customersPeriod: periodCustomers.size,
      completedSales: completedPayments.length,
      periodSales: periodPayments.length,
      revenueBrutaCents: totalRevenueCents,
      revenueBrutaPeriodCents: periodRevenueCents,
      refundPendingCount: refundPending.length,
      refundProcessedCount: refundProcessed.length,
      pageViewsPeriod: periodPageViews.length,
      visitorsPeriod: countDistinct(periodPageViews.map((event) => event.session_id)),
      ctaClicksPeriod: countDistinct(periodClicks.map((event) => event.session_id)),
      avgScrollDepth,
      checkoutStartedPeriod: periodCheckoutEvents.length,
      checkoutAbandonedPeriod: checkoutAbandonedRows.length,
      checkoutRecoveredPeriod: Math.max(0, periodCheckoutEvents.length - checkoutAbandonedRows.length),
      conversionLeadToCustomer: periodLeads.length ? (periodCustomers.size / periodLeads.length) * 100 : 0,
      conversionFreeToCustomer: periodFreeDiagnostics.size
        ? (periodCustomers.size / periodFreeDiagnostics.size) * 100
        : 0,
      refundRate: completedPayments.length ? (refundProcessed.length / completedPayments.length) * 100 : 0,
    },
    funnel,
    charts: {
      topObjectives,
      incomeRanges,
      recommendedVisas,
      topPaths: toTopItems(pathMap),
      topClicks: toTopItems(clickMap),
      topReferrers: toTopItems(referrerMap),
      devices: toTopItems(deviceMap),
      countries: toTopItems(countryMap),
      regions: toTopItems(regionMap),
      cities: toTopItems(cityMap),
    },
    tracking: {
      hotLeads,
      abandonment,
      checkoutAbandoned: checkoutAbandonedRows.slice(0, 50),
    },
    series: {
      revenue: {
        current: revenueCurrent,
        previous: revenuePrevious,
        currentTotal: revenueCurrentTotal,
        previousTotal: revenuePreviousTotal,
        delta: deltaPercent(revenueCurrentTotal, revenuePreviousTotal),
      },
      sales: {
        current: salesCurrent,
        previous: salesPrevious,
        currentTotal: salesCurrentTotal,
        previousTotal: salesPreviousTotal,
        delta: deltaPercent(salesCurrentTotal, salesPreviousTotal),
      },
      leads: {
        current: leadsCurrent,
        previous: leadsPrevious,
        currentTotal: leadsCurrentTotal,
        previousTotal: leadsPreviousTotal,
        delta: deltaPercent(leadsCurrentTotal, leadsPreviousTotal),
      },
      newCustomers: {
        current: newCustomersCurrent,
        previous: newCustomersPrevious,
        currentTotal: newCustomersCurrentTotal,
        previousTotal: newCustomersPreviousTotal,
        delta: deltaPercent(newCustomersCurrentTotal, newCustomersPreviousTotal),
      },
      refundsProcessed: {
        current: refundsCurrent,
        previous: refundsPrevious,
        currentTotal: refundsCurrentTotal,
        previousTotal: refundsPreviousTotal,
        delta: deltaPercent(refundsCurrentTotal, refundsPreviousTotal),
      },
      pageViews: {
        current: pageViewsCurrent,
        previous: pageViewsPrevious,
        currentTotal: pageViewsCurrentTotal,
        previousTotal: pageViewsPreviousTotal,
        delta: deltaPercent(pageViewsCurrentTotal, pageViewsPreviousTotal),
      },
      visitors: {
        current: visitorsCurrent,
        previous: visitorsPrevious,
        currentTotal: visitorsCurrentTotal,
        previousTotal: visitorsPreviousTotal,
        delta: deltaPercent(visitorsCurrentTotal, visitorsPreviousTotal),
      },
      checkoutStarted: {
        current: checkoutStartedCurrent,
        previous: checkoutStartedPrevious,
        currentTotal: checkoutStartedCurrentTotal,
        previousTotal: checkoutStartedPreviousTotal,
        delta: deltaPercent(checkoutStartedCurrentTotal, checkoutStartedPreviousTotal),
      },
      checkoutAbandoned: {
        current: checkoutAbandonedCurrent,
        previous: checkoutAbandonedPrevious,
        currentTotal: checkoutAbandonedCurrentTotal,
        previousTotal: checkoutAbandonedPreviousTotal,
        delta: deltaPercent(checkoutAbandonedCurrentTotal, checkoutAbandonedPreviousTotal),
      },
    },
    customers: customerRows,
    refundPendingCustomers,
    refundedCustomers,
    leads: leadRows,
    raw: {
      profiles,
      payments,
      refunds,
      freeDiagnostics,
      sessions,
      reports,
      analyticsEvents,
      profileById,
    },
  };
}
