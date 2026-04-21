import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type LeadRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  has_paid: boolean | null;
  created_at: string;
};

async function getLeads(q: string | null) {
  const supabase = supabaseAdmin();
  let query = supabase
    .from('profiles')
    .select('id,full_name,email,has_paid,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (q && q.trim()) {
    const needle = q.trim();
    query = query.or(`email.ilike.%${needle}%,full_name.ilike.%${needle}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to load leads:', error);
    return [];
  }
  return (data ?? []) as LeadRow[];
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const sp = await searchParams;
  const leads = await getLeads(sp.q ?? null);

  return (
    <>
      <Nav />
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.2 }}>Leads</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              Clique para ver detalhes (respostas, pagamentos, reembolsos).
            </p>
          </div>
          <form style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input" name="q" placeholder="Buscar por nome ou email" defaultValue={sp.q ?? ''} />
            <button className="btn btn-primary" type="submit">
              Buscar
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 12, color: 'rgba(209,213,219,0.75)' }}>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Lead</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Email</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Pago</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(55,65,81,0.25)' }}>
                    <td style={{ padding: 12, fontWeight: 700 }}>
                      <Link href={`/leads/${l.id}`} prefetch={false}>
                        {l.full_name || l.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td style={{ padding: 12 }} className="muted">
                      {l.email || '—'}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          background: l.has_paid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                          border: `1px solid ${l.has_paid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                          color: l.has_paid ? 'rgb(134,239,172)' : 'rgb(252,165,165)',
                        }}
                      >
                        {l.has_paid ? 'SIM' : 'NAO'}
                      </span>
                    </td>
                    <td style={{ padding: 12 }} className="muted">
                      {new Date(l.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && (
                  <tr>
                    <td style={{ padding: 12 }} className="muted" colSpan={4}>
                      Nenhum lead encontrado.
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
