import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import {
  buildResponseList,
  formatBusinessStatus,
  formatCurrencyBRL,
  formatDate,
  formatDateTime,
  humanizeIdentifier,
  normalizeRecommendedVisas,
  summarizeFreeDiagnostic,
  visaTypeLabels,
} from '@/lib/admin-presenters';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type TabKey = 'visao-geral' | 'pagamentos' | 'diagnosticos' | 'reembolsos' | 'relatorios';

function getTab(value: unknown): TabKey {
  switch (value) {
    case 'pagamentos':
    case 'diagnosticos':
    case 'reembolsos':
    case 'relatorios':
      return value;
    default:
      return 'visao-geral';
  }
}

function centsFromPayment(payment: any) {
  return typeof payment?.amount_cents === 'number' ? payment.amount_cents : payment?.amount ?? 0;
}

async function getPersonBundle(id: string) {
  const supabase = supabaseAdmin();

  const [profileRes, paymentsRes, refundsRes, freeDiagRes, sessionsRes, reportsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('payments')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('refund_requests')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('free_diagnostics')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('diagnostic_sessions')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('reports')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    profile: profileRes.data,
    payments: paymentsRes.data ?? [],
    refundRequests: refundsRes.data ?? [],
    freeDiagnostics: freeDiagRes.data ?? [],
    diagnosticSessions: sessionsRes.data ?? [],
    reports: reportsRes.data ?? [],
  };
}

async function getLatestDiagnosticResponses(sessionId: string | null) {
  if (!sessionId) return [];
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('diagnostic_responses')
    .select('*')
    .eq('session_id', sessionId);
  if (error) {
    console.error('Failed to load diagnostic_responses:', error);
    return [];
  }
  return data ?? [];
}

async function revokeAccess(formData: FormData) {
  'use server';
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) redirect('/leads');

  const supabase = supabaseAdmin();
  await supabase.from('profiles').update({ has_paid: false }).eq('id', userId);
  await supabase.auth.admin.updateUserById(userId, { user_metadata: { has_paid: false } });

  redirect(`/pessoas/${userId}?tab=visao-geral`);
}

export default async function PessoaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const sp = await searchParams;
  const tab = getTab(sp.tab);

  const bundle = await getPersonBundle(id);
  if (!bundle.profile) {
    return (
      <>
        <Nav current="person" />
        <div className="container">
          <div className="card">
            <h1 style={{ margin: 0 }}>Pessoa nao encontrada</h1>
          </div>
        </div>
      </>
    );
  }

  const completedPayments = bundle.payments.filter((payment: any) => payment.status === 'completed');
  const refundedPayments = bundle.payments.filter((payment: any) => payment.status === 'refunded');
  const refundPending =
    bundle.refundRequests.some((r: any) => r.status === 'pending' || r.status === 'processing') ||
    bundle.payments.some((p: any) => p.status === 'refund_pending');

  const isRefunded = refundedPayments.length > 0 || bundle.refundRequests.some((r: any) => r.status === 'processed');
  const isCustomer = bundle.profile.has_paid === true || completedPayments.length > 0;

  const badge = isRefunded
    ? { label: 'Reembolsado / acesso cancelado', tone: 'pill danger' }
    : refundPending
      ? { label: 'Refund pendente', tone: 'pill warn' }
      : isCustomer
        ? { label: 'Cliente pagante', tone: 'pill success' }
        : { label: 'Lead', tone: 'pill warn' };

  const latestFree = bundle.freeDiagnostics[0] ?? null;
  const freeSummary = summarizeFreeDiagnostic(latestFree?.responses as Record<string, unknown> | null);
  const recommendedVisas = normalizeRecommendedVisas(latestFree?.recommended_visas);

  const latestSession = bundle.diagnosticSessions[0] ?? null;
  const latestResponses = await getLatestDiagnosticResponses(latestSession?.id ?? null);
  const responseList = buildResponseList(
    latestResponses.map((item: any) => ({ question_id: item.question_id, answer: item.answer }))
  );

  const latestReport = bundle.reports[0] ?? null;
  const reportContent = (latestReport?.content as Record<string, unknown> | null) ?? null;
  const reportStrengths = Array.isArray(reportContent?.strengths) ? (reportContent?.strengths as string[]) : [];
  const reportNextSteps = Array.isArray(reportContent?.nextSteps) ? (reportContent?.nextSteps as string[]) : [];

  const totalPaidCents = completedPayments.reduce((sum: number, payment: any) => sum + centsFromPayment(payment), 0);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'visao-geral', label: 'Visao geral' },
    { key: 'pagamentos', label: 'Pagamentos' },
    { key: 'diagnosticos', label: 'Diagnosticos' },
    { key: 'reembolsos', label: 'Reembolsos' },
    { key: 'relatorios', label: 'Relatorios' },
  ];

  return (
    <>
      <Nav current="person" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Ficha</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
            {bundle.profile.full_name || 'Sem nome'}
          </h1>
          <p className="muted" style={{ marginTop: 14, fontSize: 17 }}>
            {bundle.profile.email || 'Sem e-mail cadastrado'}
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <span className={badge.tone}>{badge.label}</span>
            {latestSession?.visa_type ? (
              <span className="pill">
                Visto (ultimo): {visaTypeLabels[latestSession.visa_type] ?? humanizeIdentifier(latestSession.visa_type)}
              </span>
            ) : null}
            {completedPayments[0]?.created_at ? (
              <span className="pill">
                Ultima compra: {formatDateTime(completedPayments[0].created_at)}
              </span>
            ) : null}
            {totalPaidCents > 0 ? (
              <span className="pill">
                Total pago: {formatCurrencyBRL(totalPaidCents / 100)}
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/pessoas/${bundle.profile.id}?tab=${t.key}`}
                prefetch={false}
                className={`nav-link ${tab === t.key ? 'active' : ''}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {tab === 'visao-geral' ? (
          <div className="grid">
            <div className="col-8 stack">
              <div className="card">
                <div className="section-title">Resumo</div>
                <div className="kv-grid">
                  <div className="kv-card">
                    <div className="kv-label">Criado em</div>
                    <div className="kv-value">{bundle.profile.created_at ? formatDateTime(bundle.profile.created_at) : '—'}</div>
                  </div>
                  <div className="kv-card">
                    <div className="kv-label">Diagnostico gratuito</div>
                    <div className="kv-value">
                      {latestFree ? `Concluido em ${formatDateTime(latestFree.completed_at || latestFree.created_at)}` : 'Ainda nao concluiu'}
                    </div>
                  </div>
                  <div className="kv-card">
                    <div className="kv-label">Diagnostico completo</div>
                    <div className="kv-value">
                      {latestSession ? (visaTypeLabels[latestSession.visa_type] ?? latestSession.visa_type) : 'Ainda nao iniciou'}
                    </div>
                  </div>
                  <div className="kv-card">
                    <div className="kv-label">Relatorio mais recente</div>
                    <div className="kv-value">
                      {latestReport ? `${visaTypeLabels[latestReport.visa_type] ?? latestReport.visa_type} em ${formatDate(latestReport.created_at)}` : 'Ainda sem relatorio'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="section-title">Respostas mais importantes do diagnostico gratuito</div>
                {freeSummary.length === 0 ? (
                  <div className="muted">Ainda nao ha respostas salvas do diagnostico gratuito.</div>
                ) : (
                  <div className="kv-grid">
                    {freeSummary.map((item) => (
                      <div className="kv-card" key={item.id}>
                        <div className="kv-label">{item.label}</div>
                        <div className="kv-value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="col-4 stack">
              <div className="card">
                <div className="section-title">Acao rapida</div>
                <form action={revokeAccess}>
                  <input type="hidden" name="user_id" value={bundle.profile.id} />
                  <button className="btn btn-primary" type="submit">
                    Cancelar acesso deste cliente
                  </button>
                </form>
              </div>

              <div className="card">
                <div className="section-title">Vistos recomendados (gratis)</div>
                <div className="muted">
                  {recommendedVisas.length ? recommendedVisas.join(', ') : 'Sem recomendacao salva.'}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'pagamentos' ? (
          <div className="card">
            <div className="section-title">Pagamentos</div>
            {bundle.payments.length === 0 ? (
              <div className="muted">Nenhum pagamento encontrado.</div>
            ) : (
              <div className="table-shell">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.payments.map((payment: any) => {
                      const amount = centsFromPayment(payment);
                      return (
                        <tr key={payment.id}>
                          <td>{formatCurrencyBRL(amount / 100)}</td>
                          <td>{formatBusinessStatus(payment.status)}</td>
                          <td className="muted">{formatDateTime(payment.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'diagnosticos' ? (
          <div className="grid">
            <div className={isCustomer ? 'col-6 stack' : 'col-12 stack'}>
              <div className="card">
                <div className="section-title">Diagnostico gratuito</div>
                {latestFree ? (
                  <div className="muted">
                    Concluido em {formatDateTime(latestFree.completed_at || latestFree.created_at)}
                  </div>
                ) : (
                  <div className="muted">Ainda nao concluiu.</div>
                )}
              </div>

              <div className="card">
                <div className="section-title">Resumo (gratis)</div>
                {freeSummary.length === 0 ? (
                  <div className="muted">Sem respostas salvas.</div>
                ) : (
                  <div className="kv-grid">
                    {freeSummary.map((item) => (
                      <div className="kv-card" key={item.id}>
                        <div className="kv-label">{item.label}</div>
                        <div className="kv-value">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isCustomer ? (
              <div className="col-6 stack">
                <div className="card">
                  <div className="section-title">Diagnostico especifico</div>
                  {latestSession ? (
                    <>
                      <div className="muted" style={{ marginBottom: 14 }}>
                        Formulario mais recente: {visaTypeLabels[latestSession.visa_type] ?? humanizeIdentifier(latestSession.visa_type)}
                      </div>
                      {responseList.length === 0 ? (
                        <div className="muted">Nao ha respostas salvas para leitura.</div>
                      ) : (
                        <div className="kv-grid">
                          {responseList.map((item) => (
                            <div className="kv-card" key={item.id}>
                              <div className="kv-label">{item.label}</div>
                              <div className="kv-value">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="muted">Ainda nao iniciou.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'reembolsos' ? (
          <div className="card">
            <div className="section-title">Reembolsos</div>
            {bundle.refundRequests.length === 0 ? (
              <div className="muted">Nenhum pedido de reembolso.</div>
            ) : (
              <div className="table-shell">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Data</th>
                      <th>Motivo</th>
                      <th>Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.refundRequests.map((refund: any) => (
                      <tr key={refund.id}>
                        <td>{formatBusinessStatus(refund.status)}</td>
                        <td className="muted">{formatDateTime(refund.created_at)}</td>
                        <td>{refund.reason ? String(refund.reason) : <span className="muted">—</span>}</td>
                        <td className="muted">{refund.error_message ? String(refund.error_message) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {tab === 'relatorios' ? (
          <div className="card">
            <div className="section-title">Relatorios</div>
            {!latestReport ? (
              <div className="muted">Ainda nao existe relatorio salvo.</div>
            ) : (
              <div className="stack">
                <div className="muted" style={{ marginTop: 6 }}>
                  {visaTypeLabels[latestReport.visa_type] ?? humanizeIdentifier(latestReport.visa_type)} — {formatDate(latestReport.created_at)}
                </div>

                {!reportContent ? (
                  <div className="muted">Conteudo do relatorio ausente.</div>
                ) : (
                  <>
                    <div className="kv-card">
                      <div className="kv-label">Resumo</div>
                      <div className="kv-value" style={{ fontWeight: 500 }}>
                        {typeof reportContent.summary === 'string' && reportContent.summary
                          ? reportContent.summary
                          : 'Sem resumo salvo'}
                      </div>
                    </div>
                    <div className="grid">
                      <div className="col-6">
                        <div className="kv-card">
                          <div className="kv-label">Pontos fortes</div>
                          <div className="kv-value" style={{ fontWeight: 500 }}>
                            {reportStrengths.length ? reportStrengths.join(', ') : 'Sem pontos fortes'}
                          </div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="kv-card">
                          <div className="kv-label">Proximos passos</div>
                          <div className="kv-value" style={{ fontWeight: 500 }}>
                            {reportNextSteps.length ? reportNextSteps.join(', ') : 'Sem proximos passos'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
