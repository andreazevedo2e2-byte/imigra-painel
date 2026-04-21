import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import {
  buildResponseList,
  formatBusinessStatus,
  formatCurrencyBRL,
  formatDate,
  formatDateTime,
  normalizeRecommendedVisas,
  summarizeFreeDiagnostic,
  visaTypeLabels,
} from '@/lib/admin-presenters';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getLeadBundle(id: string) {
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
      .limit(5),
    supabase
      .from('reports')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
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

  redirect(`/leads/${userId}`);
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const bundle = await getLeadBundle(id);

  if (!bundle.profile) {
    return (
      <>
        <Nav current="leads" />
        <div className="container">
          <div className="card">
            <h1 style={{ margin: 0 }}>Lead nao encontrado</h1>
          </div>
        </div>
      </>
    );
  }

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
  const totalPaid = bundle.payments
    .filter((payment: any) => payment.status === 'completed')
    .reduce((sum: number, payment: any) => sum + (payment.amount ?? 0), 0);

  return (
    <>
      <Nav current="leads" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Ficha do lead</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
            {bundle.profile.full_name || 'Lead sem nome'}
          </h1>
          <p className="muted" style={{ marginTop: 14, fontSize: 17 }}>
            {bundle.profile.email || 'Sem e-mail cadastrado'}
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <span className={`pill ${bundle.profile.has_paid ? 'success' : 'warn'}`}>
              {bundle.profile.has_paid ? 'Cliente pagante' : 'Lead em aberto'}
            </span>
            <span className="pill">Entrou em {formatDate(bundle.profile.created_at)}</span>
            <span className="pill">Total pago: {formatCurrencyBRL(totalPaid / 100)}</span>
          </div>
        </div>

        <div className="grid">
          <div className="col-8 stack">
            <div className="card">
              <div className="section-title">Resumo rapido</div>
              <div className="kv-grid">
                <div className="kv-card">
                  <div className="kv-label">Diagnostico gratuito</div>
                  <div className="kv-value">
                    {latestFree ? `Concluido em ${formatDateTime(latestFree.completed_at || latestFree.created_at)}` : 'Ainda nao concluiu'}
                  </div>
                </div>
                <div className="kv-card">
                  <div className="kv-label">Diagnostico completo mais recente</div>
                  <div className="kv-value">
                    {latestSession ? visaTypeLabels[latestSession.visa_type] || latestSession.visa_type : 'Ainda nao iniciou'}
                  </div>
                </div>
                <div className="kv-card">
                  <div className="kv-label">Relatorio mais recente</div>
                  <div className="kv-value">
                    {latestReport ? `${visaTypeLabels[latestReport.visa_type] || latestReport.visa_type} em ${formatDate(latestReport.created_at)}` : 'Ainda sem relatorio'}
                  </div>
                </div>
                <div className="kv-card">
                  <div className="kv-label">Vistos mais recomendados</div>
                  <div className="kv-value">
                    {recommendedVisas.length ? recommendedVisas.join(', ') : 'Sem recomendacao salva'}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-title">Respostas mais importantes do diagnostico gratuito</div>
              {freeSummary.length === 0 ? (
                <div className="muted">Ainda nao ha respostas salvas do diagnostico gratuito para este lead.</div>
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

            <div className="card">
              <div className="section-title">Respostas do diagnostico especifico</div>
              {latestSession ? (
                <>
                  <div className="muted" style={{ marginBottom: 14 }}>
                    Formulario mais recente: {visaTypeLabels[latestSession.visa_type] || latestSession.visa_type}
                  </div>
                  {responseList.length === 0 ? (
                    <div className="muted">
                      O formulario foi iniciado, mas ainda nao ha respostas salvas para leitura.
                    </div>
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
                <div className="muted">Ainda nao iniciou formulario especifico.</div>
              )}
            </div>

            <div className="card">
              <div className="section-title">Leitura do ultimo relatorio</div>
              {!reportContent ? (
                <div className="muted">Ainda nao existe relatorio salvo para este lead.</div>
              ) : (
                <div className="stack">
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
                          {reportStrengths.length ? reportStrengths.join(', ') : 'Sem pontos fortes destacados'}
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="kv-card">
                        <div className="kv-label">Proximos passos</div>
                        <div className="kv-value" style={{ fontWeight: 500 }}>
                          {reportNextSteps.length ? reportNextSteps.join(', ') : 'Sem proximos passos salvos'}
                        </div>
                      </div>
                    </div>
                  </div>
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
              <div className="section-title">Historico de pagamentos</div>
              {bundle.payments.length === 0 ? (
                <div className="muted">Nenhum pagamento encontrado.</div>
              ) : (
                <div className="timeline">
                  {bundle.payments.map((payment: any) => (
                    <div className="timeline-item" key={payment.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <strong>{formatCurrencyBRL((payment.amount ?? 0) / 100)}</strong>
                        <span className="muted">{formatBusinessStatus(payment.status)}</span>
                      </div>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Compra em {formatDateTime(payment.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="section-title">Historico de reembolso</div>
              {bundle.refundRequests.length === 0 ? (
                <div className="muted">Este lead ainda nao pediu reembolso.</div>
              ) : (
                <div className="timeline">
                  {bundle.refundRequests.map((refund: any) => (
                    <div className="timeline-item" key={refund.id}>
                      <strong>{formatBusinessStatus(refund.status)}</strong>
                      <div className="muted" style={{ marginTop: 8 }}>
                        Pedido em {formatDateTime(refund.created_at)}
                      </div>
                      {refund.reason ? (
                        <div style={{ marginTop: 10, lineHeight: 1.5 }}>{String(refund.reason)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
