import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

async function getLeadBundle(id: string) {
  const supabase = supabaseAdmin();

  const [profileRes, paymentsRes, refundsRes, freeDiagRes, sessionsRes] = await Promise.all([
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
      .limit(3),
  ]);

  return {
    profile: profileRes.data,
    payments: paymentsRes.data ?? [],
    refundRequests: refundsRes.data ?? [],
    freeDiagnostics: freeDiagRes.data ?? [],
    diagnosticSessions: sessionsRes.data ?? [],
    errors: [
      profileRes.error,
      paymentsRes.error,
      refundsRes.error,
      freeDiagRes.error,
      sessionsRes.error,
    ].filter(Boolean),
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
  // Keep auth metadata aligned with ImigraPlan middleware fallback.
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { has_paid: false },
  });

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
        <Nav />
        <div className="container">
          <h1 style={{ margin: 0, fontSize: 28 }}>Lead nao encontrado</h1>
          <p className="muted">ID: {id}</p>
        </div>
      </>
    );
  }

  const latestSessionId = bundle.diagnosticSessions?.[0]?.id ?? null;
  const diagnosticResponses = await getLatestDiagnosticResponses(latestSessionId);

  return (
    <>
      <Nav />
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: -0.2 }}>
              {bundle.profile.full_name || 'Lead'}{' '}
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
                ({bundle.profile.id})
              </span>
            </h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {bundle.profile.email || '—'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                has_paid
              </div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                {bundle.profile.has_paid ? 'SIM' : 'NAO'}
              </div>
            </div>
            <form action={revokeAccess}>
              <input type="hidden" name="user_id" value={bundle.profile.id} />
              <button className="btn btn-primary" type="submit">
                Cancelar acesso
              </button>
            </form>
          </div>
        </div>

        <div className="grid">
          <div className="card col-6">
            <h2 style={{ margin: 0, fontSize: 16 }}>Pagamentos</h2>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(bundle.payments, null, 2)}
            </pre>
          </div>
          <div className="card col-6">
            <h2 style={{ margin: 0, fontSize: 16 }}>Solicitacoes de reembolso</h2>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(bundle.refundRequests, null, 2)}
            </pre>
          </div>
          <div className="card col-6">
            <h2 style={{ margin: 0, fontSize: 16 }}>Diagnostico gratis (free_diagnostics)</h2>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(bundle.freeDiagnostics, null, 2)}
            </pre>
          </div>
          <div className="card col-6">
            <h2 style={{ margin: 0, fontSize: 16 }}>Diagnostico completo</h2>
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Sessions (diagnostic_sessions)
            </div>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(bundle.diagnosticSessions, null, 2)}
            </pre>
            <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
              Latest responses (diagnostic_responses) - session_id: {latestSessionId || '—'}
            </div>
            <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(diagnosticResponses, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}
