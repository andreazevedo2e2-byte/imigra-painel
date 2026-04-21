import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function startOfDayIso(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function getKpis() {
  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const sinceIso = startOfDayIso(since);

  const [{ data: payments }, { data: refunds }] = await Promise.all([
    supabase
      .from('payments')
      .select('amount,status,created_at')
      .gte('created_at', sinceIso),
    supabase
      .from('refund_requests')
      .select('id,status')
      .in('status', ['pending', 'processing']),
  ]);

  const completed = (payments ?? []).filter((p) => p.status === 'completed');
  const revenueCents = completed.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return {
    revenueCents,
    salesCount: completed.length,
    pendingRefunds: (refunds ?? []).length,
  };
}

export default async function DashboardPage() {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const kpis = await getKpis();
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <Nav />
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.2 }}>Dashboard</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              Visao geral (MVP). Nas proximas telas: filtros por respostas e drill-down por buckets.
            </p>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Logado como
            </div>
            <div style={{ fontWeight: 800 }}>{session.email}</div>
          </div>
        </div>

        <div className="grid" style={{ marginTop: 18 }}>
          <div className="card col-4">
            <div className="muted" style={{ fontSize: 12 }}>
              Receita (30d)
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
              {brl.format(kpis.revenueCents / 100)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Fonte: tabela payments (status=completed)
            </div>
          </div>
          <div className="card col-4">
            <div className="muted" style={{ fontSize: 12 }}>
              Vendas (30d)
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{kpis.salesCount}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Fonte: tabela payments
            </div>
          </div>
          <div className="card col-4">
            <div className="muted" style={{ fontSize: 12 }}>
              Reembolsos pendentes
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{kpis.pendingRefunds}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Fonte: tabela refund_requests
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
