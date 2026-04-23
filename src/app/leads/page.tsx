import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatDateTime } from '@/lib/admin-presenters';
import { getAdminSnapshot } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const sp = await searchParams;
  const snapshot = await getAdminSnapshot();
  const q = sp.q?.trim().toLowerCase() ?? '';

  const openLeads = snapshot.leads.filter((lead) => lead.status === 'lead');

  const leads = openLeads.filter((lead) => {
    if (q && !`${lead.name} ${lead.email}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const openLeadCount = openLeads.length;
  const freeCompletedCount = openLeads.filter((lead) => lead.hasFreeDiagnostic).length;
  const freeNotCompletedCount = Math.max(0, openLeadCount - freeCompletedCount);

  return (
    <>
      <Nav current="leads" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Leads</div>
          <div className="muted">Ainda nao pagaram.</div>
        </div>

        <div className="grid">
          <div className="col-4">
            <StatCard label="Leads abertos" value={String(openLeadCount)} />
          </div>
          <div className="col-4">
            <StatCard label="Gratis concluido" value={String(freeCompletedCount)} />
          </div>
          <div className="col-4">
            <StatCard label="Gratis pendente" value={String(freeNotCompletedCount)} />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="input" name="q" placeholder="Buscar por nome ou e-mail" defaultValue={sp.q ?? ''} style={{ minWidth: 280 }} />
              <button className="btn btn-primary" type="submit">Buscar</button>
            </form>
          </div>

          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contato</th>
                  <th>Diagnostico gratis</th>
                  <th>Ultimo evento</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`/pessoas/${lead.id}?tab=diagnosticos`} prefetch={false}>{lead.name}</Link>
                    </td>
                    <td className="muted">{lead.email}</td>
                    <td>{lead.hasFreeDiagnostic ? 'Concluido' : 'Nao'}</td>
                    <td className="muted">{lead.lastEventAt ? formatDateTime(lead.lastEventAt) : formatDateTime(lead.createdAt)}</td>
                  </tr>
                ))}
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">Nenhum lead encontrado.</td>
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
