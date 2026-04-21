import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatCurrencyBRL, formatDateTime, humanizeIdentifier, visaTypeLabels } from '@/lib/admin-presenters';
import { getAdminSnapshot } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const sp = await searchParams;
  const snapshot = await getAdminSnapshot();
  const filter =
    sp.filter === 'reembolsados'
      ? 'reembolsados'
      : sp.filter === 'refund_pendente'
        ? 'refund_pendente'
        : sp.filter === 'todos'
          ? 'todos'
          : 'ativos';
  const q = sp.q?.trim().toLowerCase() ?? '';

  const combined = [
    ...snapshot.customers,
    ...snapshot.leads.filter((lead) => lead.status === 'refund_pendente' || lead.status === 'reembolsado'),
  ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index);

  const rows = combined.filter((row) => {
    if (filter === 'ativos' && row.status !== 'ativo') return false;
    if (filter === 'refund_pendente' && row.status !== 'refund_pendente') return false;
    if (filter === 'reembolsados' && row.status !== 'reembolsado') return false;
    if (q && !`${row.name} ${row.email}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      <Nav current="clients" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Clientes</div>
          <div className="muted">Cliente ativo = pagou, segue com acesso e nao tem reembolso concluido.</div>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Ativos" value={String(snapshot.customers.length)} />
          </div>
          <div className="col-3">
            <StatCard label="Refund pendente" value={String(snapshot.leads.filter((lead) => lead.status === 'refund_pendente').length)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolsados" value={String(snapshot.leads.filter((lead) => lead.status === 'reembolsado').length)} />
          </div>
          <div className="col-3">
            <StatCard label="Receita historica" value={formatCurrencyBRL(snapshot.metrics.revenueBrutaCents / 100)} />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { href: '/clientes?filter=ativos', label: 'Ativos', active: filter === 'ativos' },
                { href: '/clientes?filter=refund_pendente', label: 'Refund pendente', active: filter === 'refund_pendente' },
                { href: '/clientes?filter=reembolsados', label: 'Reembolsados', active: filter === 'reembolsados' },
                { href: '/clientes?filter=todos', label: 'Todos', active: filter === 'todos' },
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
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Compra</th>
                  <th>Valor</th>
                  <th>Visto</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><Link href={`/leads/${row.id}`} prefetch={false}>{row.name}</Link></td>
                    <td className="muted">{row.email}</td>
                    <td className="muted">{row.activePayment?.created_at ? formatDateTime(row.activePayment.created_at) : '-'}</td>
                    <td>{row.activePayment?.amount ? formatCurrencyBRL(row.activePayment.amount / 100) : '-'}</td>
                    <td>{row.latestVisaType ? (visaTypeLabels[row.latestVisaType] ?? humanizeIdentifier(row.latestVisaType)) : '-'}</td>
                    <td>
                      {row.status === 'ativo'
                        ? 'Ativo'
                        : row.status === 'refund_pendente'
                          ? 'Refund pendente'
                          : 'Reembolsado'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">Nenhum cliente encontrado.</td>
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
