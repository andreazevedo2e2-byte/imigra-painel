import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatDateTime } from '@/lib/admin-presenters';
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
    .limit(300);

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
  const paidCount = leads.filter((lead) => lead.has_paid).length;

  return (
    <>
      <Nav current="leads" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Clientes e leads</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(28px, 4vw, 44px)' }}>
            Veja quem entrou, quem pagou e quem merece acompanhamento imediato.
          </h1>
          <p className="muted" style={{ marginTop: 14, maxWidth: 740, fontSize: 17 }}>
            Clique em qualquer lead para abrir a ficha completa, com respostas do formulario,
            historico de pagamento, pedido de reembolso e situacao atual.
          </p>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Leads listados" value={String(leads.length)} />
          </div>
          <div className="col-3">
            <StatCard label="Pagaram" value={String(paidCount)} />
          </div>
          <div className="col-3">
            <StatCard label="Nao pagaram" value={String(leads.length - paidCount)} />
          </div>
          <div className="col-3">
            <StatCard label="Busca atual" value={sp.q?.trim() ? 'Filtrada' : 'Completa'} />
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              Base de clientes
            </div>
            <form style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="input"
                name="q"
                placeholder="Buscar por nome ou e-mail"
                defaultValue={sp.q ?? ''}
                style={{ minWidth: 280 }}
              />
              <button className="btn btn-primary" type="submit">
                Buscar
              </button>
            </form>
          </div>

          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contato</th>
                  <th>Situacao</th>
                  <th>Entrada</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`/leads/${lead.id}`} prefetch={false}>
                        {lead.full_name || 'Lead sem nome'}
                      </Link>
                    </td>
                    <td className="muted">{lead.email || 'Sem e-mail'}</td>
                    <td>
                      <span className={`pill ${lead.has_paid ? 'success' : 'warn'}`}>
                        {lead.has_paid ? 'Cliente pagante' : 'Lead em aberto'}
                      </span>
                    </td>
                    <td className="muted">{formatDateTime(lead.created_at)}</td>
                  </tr>
                ))}
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      Nenhum lead encontrado para este filtro.
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

