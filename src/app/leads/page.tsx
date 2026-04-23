import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatDateTime, humanizeIdentifier, visaTypeLabels } from '@/lib/admin-presenters';
import { getAdminSnapshot } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const sp = await searchParams;
  const snapshot = await getAdminSnapshot();
  const filter = sp.filter === 'reembolsados' ? 'reembolsados' : sp.filter === 'todos' ? 'todos' : 'abertos';
  const q = sp.q?.trim().toLowerCase() ?? '';

  const leads = snapshot.leads.filter((lead) => {
    if (filter === 'abertos' && lead.status !== 'lead') return false;
    if (filter === 'reembolsados' && lead.status !== 'reembolsado') return false;
    if (q && !`${lead.name} ${lead.email}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      <Nav current="leads" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Leads</div>
          <div className="muted">Nao pagaram ou ja passaram por reembolso.</div>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Leads abertos" value={String(snapshot.leads.filter((lead) => lead.status === 'lead').length)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolsados" value={String(snapshot.leads.filter((lead) => lead.status === 'reembolsado').length)} />
          </div>
          <div className="col-3">
            <StatCard
              label="Gratis concluidos"
              value={String(snapshot.leads.filter((lead) => lead.hasFreeDiagnostic).length)}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Especifico iniciado"
              value={String(snapshot.leads.filter((lead) => lead.hasSpecificStarted).length)}
            />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { href: '/leads?filter=abertos', label: 'Abertos', active: filter === 'abertos' },
                { href: '/leads?filter=reembolsados', label: 'Reembolsados', active: filter === 'reembolsados' },
                { href: '/leads?filter=todos', label: 'Todos', active: filter === 'todos' },
              ].map((item) => (
                <Link key={item.href} href={item.href} prefetch={false} className={`nav-link ${item.active ? 'active' : ''}`}>
                  {item.label}
                </Link>
              ))}
            </div>

            <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input name="filter" type="hidden" value={filter} />
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
                  <th>Especifico</th>
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
                    <td>{lead.latestVisaType ? (visaTypeLabels[lead.latestVisaType] ?? humanizeIdentifier(lead.latestVisaType)) : 'Nao iniciou'}</td>
                    <td className="muted">{lead.lastEventAt ? formatDateTime(lead.lastEventAt) : formatDateTime(lead.createdAt)}</td>
                  </tr>
                ))}
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">Nenhum lead encontrado.</td>
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
