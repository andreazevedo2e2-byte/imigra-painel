import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatCurrencyBRL, formatDateTime, humanizeIdentifier, visaTypeLabels } from '@/lib/admin-presenters';
import { getAdminSnapshot, getPaymentAmountCents } from '@/lib/admin-data';

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
    ...snapshot.refundPendingCustomers,
    ...snapshot.refundedCustomers,
  ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index);

  const rows = combined.filter((row) => {
    if (filter === 'ativos' && row.status !== 'ativo') return false;
    if (filter === 'refund_pendente' && row.status !== 'refund_pendente') return false;
    if (filter === 'reembolsados' && row.status !== 'reembolsado') return false;
    if (q && !`${row.name} ${row.email}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const reportUsers = new Set((snapshot.raw.reports ?? []).map((r: any) => r.user_id).filter(Boolean));
  const customersWithoutReport = snapshot.customers.filter((customer) => !reportUsers.has(customer.id)).length;
  const lastCompletedSale = snapshot.raw.payments
    .filter((p: any) => p.status === 'completed' && p.created_at)
    .slice()
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 1)[0] ?? null;

  return (
    <>
      <Nav current="clients" />
      <div className="container stack">
        <div className="card highlight-panel page-head">
          <div>
            <div className="page-title">Clientes</div>
            <div className="page-subtitle">Ativo = pagou, segue com acesso e nao tem reembolso concluido.</div>
          </div>
          <div className="badge-row">
            <span className="pill success">Ativos: <strong>{snapshot.customers.length}</strong></span>
            <span className="pill warn">Refund pendente: <strong>{snapshot.refundPendingCustomers.length}</strong></span>
            <span className="pill danger">Reembolsados: <strong>{snapshot.refundedCustomers.length}</strong></span>
          </div>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Ativos" value={String(snapshot.customers.length)} />
          </div>
          <div className="col-3">
            <StatCard label="Refund pendente" value={String(snapshot.refundPendingCustomers.length)} />
          </div>
          <div className="col-3">
            <StatCard label="Reembolsados" value={String(snapshot.refundedCustomers.length)} />
          </div>
          <div className="col-3">
            <StatCard
              label="Clientes sem relatorio"
              value={String(customersWithoutReport)}
              hint={lastCompletedSale?.created_at ? `Ultima venda: ${formatDateTime(lastCompletedSale.created_at)}` : undefined}
            />
          </div>
        </div>

        <div className="card table-card">
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <div className="segmented" role="tablist" aria-label="Filtro de clientes">
              <Link href="/clientes?filter=ativos" prefetch={false} className={`seg-btn ${filter === 'ativos' ? 'active' : ''}`}>Ativos</Link>
              <Link href="/clientes?filter=refund_pendente" prefetch={false} className={`seg-btn ${filter === 'refund_pendente' ? 'active' : ''}`}>Refund pendente</Link>
              <Link href="/clientes?filter=reembolsados" prefetch={false} className={`seg-btn ${filter === 'reembolsados' ? 'active' : ''}`}>Reembolsados</Link>
              <Link href="/clientes?filter=todos" prefetch={false} className={`seg-btn ${filter === 'todos' ? 'active' : ''}`}>Todos</Link>
            </div>

            <form className="search-form">
              <input name="filter" type="hidden" value={filter} />
              <input className="input search-input" name="q" placeholder="Buscar por nome ou e-mail" defaultValue={sp.q ?? ''} />
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
                  <th>Visto (ultimo)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><Link href={`/pessoas/${row.id}?tab=pagamentos`} prefetch={false}>{row.name}</Link></td>
                    <td className="muted">{row.email}</td>
                    <td className="muted">{row.activePayment?.created_at ? formatDateTime(row.activePayment.created_at) : '-'}</td>
                    <td>{row.activePayment ? formatCurrencyBRL(getPaymentAmountCents(row.activePayment) / 100) : '-'}</td>
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
