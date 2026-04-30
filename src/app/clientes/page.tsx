import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatCurrencyBRL, formatDateTime, humanizeIdentifier, visaTypeLabels } from '@/lib/admin-presenters';
import { getAdminSnapshot, getPaymentAmountCents, setUserAccessFlag } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

async function blockCustomerAccess(formData: FormData) {
  'use server';

  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const userId = String(formData.get('user_id') ?? '').trim();
  if (!userId) redirect('/clientes?error=' + encodeURIComponent('Cliente invalido.'));

  await setUserAccessFlag(userId, false);
  revalidatePath('/');
  revalidatePath('/clientes');
  revalidatePath(`/pessoas/${userId}`);
  redirect('/clientes?success=' + encodeURIComponent('Acesso bloqueado.'));
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; success?: string; error?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const sp = await searchParams;
  const snapshot = await getAdminSnapshot();
  const filter =
    sp.filter === 'reembolsados'
      ? 'reembolsados'
      : sp.filter === 'bloqueados'
        ? 'bloqueados'
      : sp.filter === 'refund_pendente'
        ? 'refund_pendente'
        : sp.filter === 'todos'
          ? 'todos'
          : 'ativos';
  const q = sp.q?.trim().toLowerCase() ?? '';

  const combined = [
    ...snapshot.customers,
    ...snapshot.blockedCustomers,
    ...snapshot.refundPendingCustomers,
    ...snapshot.refundedCustomers,
  ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index);

  const rows = combined.filter((row) => {
    if (filter === 'ativos' && row.status !== 'ativo') return false;
    if (filter === 'bloqueados' && row.status !== 'bloqueado') return false;
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
            <div className="page-subtitle">Clientes pagantes ativos, bloqueados ou com reembolso.</div>
          </div>
          <div className="badge-row">
            <span className="pill success">Ativos: <strong>{snapshot.customers.length}</strong></span>
            <span className="pill warn">Bloqueados: <strong>{snapshot.blockedCustomers.length}</strong></span>
            <span className="pill warn">Reembolso pendente: <strong>{snapshot.refundPendingCustomers.length}</strong></span>
            <span className="pill danger">Reembolsados: <strong>{snapshot.refundedCustomers.length}</strong></span>
          </div>
        </div>

        {sp.success ? <div className="card soft" style={{ borderColor: 'rgba(79, 209, 165, 0.25)' }}>{sp.success}</div> : null}
        {sp.error ? <div className="card soft" style={{ borderColor: 'rgba(255, 125, 125, 0.25)' }}>{sp.error}</div> : null}

        <div className="grid">
          <div className="col-3">
            <StatCard label="Ativos" value={String(snapshot.customers.length)} />
          </div>
          <div className="col-3">
            <StatCard label="Bloqueados" value={String(snapshot.blockedCustomers.length)} />
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
              <Link href="/clientes?filter=bloqueados" prefetch={false} className={`seg-btn ${filter === 'bloqueados' ? 'active' : ''}`}>Bloqueados</Link>
              <Link href="/clientes?filter=refund_pendente" prefetch={false} className={`seg-btn ${filter === 'refund_pendente' ? 'active' : ''}`}>Reembolso pendente</Link>
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
                  <th>Acesso</th>
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
                        : row.status === 'bloqueado'
                          ? 'Bloqueado'
                        : row.status === 'refund_pendente'
                          ? 'Reembolso pendente'
                          : 'Reembolsado'}
                    </td>
                    <td>
                      {row.status === 'ativo' ? (
                        <form action={blockCustomerAccess}>
                          <input type="hidden" name="user_id" value={row.id} />
                          <button className="btn btn-ghost" type="submit">Bloquear acesso</button>
                        </form>
                      ) : row.status === 'bloqueado' ? (
                        <span className="pill warn">Bloqueado</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">Nenhum cliente encontrado.</td>
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
