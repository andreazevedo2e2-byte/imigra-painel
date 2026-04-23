import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { BarChart, DonutChart, MiniTable } from '@/components/dashboard-ui';
import { MetricLineCard } from '@/components/metric-line-card';
import { formatAnswer, formatDateTime, humanizeIdentifier } from '@/lib/admin-presenters';
import { requireAdminSession } from '@/lib/auth';
import { getAdminSnapshot, getPaymentAmountCents } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

function parsePeriodDays(input: unknown) {
  const raw = typeof input === 'string' ? input.trim() : '';
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days)) return 30;
  if (days === 7 || days === 30 || days === 90) return days;
  return 30;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const sp = await searchParams;
  const periodDays = parsePeriodDays(sp.days);
  const snapshot = await getAdminSnapshot(periodDays);

  return (
    <>
      <Nav current="dashboard" />
      <div className="container stack">
        <div className="card highlight-panel" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="section-title" style={{ marginBottom: 10 }}>Dashboard</div>
            <div className="muted">Ultimos {periodDays} dias (comparado ao periodo anterior).</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="pill success">Clientes ativos: <strong>{snapshot.metrics.activeCustomersNow}</strong></span>
            <span className="pill warn">Reembolsos pendentes: <strong>{snapshot.metrics.refundPendingCount}</strong></span>
            <span className="pill">Taxa de reembolso: <strong>{snapshot.metrics.refundRate.toFixed(1)}%</strong></span>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="Periodo">
          <a className={`seg-btn ${periodDays === 7 ? 'active' : ''}`} href="/?days=7">7 dias</a>
          <a className={`seg-btn ${periodDays === 30 ? 'active' : ''}`} href="/?days=30">30 dias</a>
          <a className={`seg-btn ${periodDays === 90 ? 'active' : ''}`} href="/?days=90">90 dias</a>
        </div>

        <div className="grid">
          <div className="col-6">
            <MetricLineCard
              title="Volume bruto"
              unit="brl_cents"
              currentTotal={snapshot.series.revenue.currentTotal}
              previousTotal={snapshot.series.revenue.previousTotal}
              delta={snapshot.series.revenue.delta}
              current={snapshot.series.revenue.current}
              previous={snapshot.series.revenue.previous}
              accent="violet"
            />
          </div>
          <div className="col-6">
            <MetricLineCard
              title="Novos clientes"
              unit="count"
              currentTotal={snapshot.series.newCustomers.currentTotal}
              previousTotal={snapshot.series.newCustomers.previousTotal}
              delta={snapshot.series.newCustomers.delta}
              current={snapshot.series.newCustomers.current}
              previous={snapshot.series.newCustomers.previous}
              accent="violet"
            />
          </div>
          <div className="col-4">
            <MetricLineCard
              title="Vendas concluidas"
              unit="count"
              currentTotal={snapshot.series.sales.currentTotal}
              previousTotal={snapshot.series.sales.previousTotal}
              delta={snapshot.series.sales.delta}
              current={snapshot.series.sales.current}
              previous={snapshot.series.sales.previous}
              accent="orange"
            />
          </div>
          <div className="col-4">
            <MetricLineCard
              title="Leads cadastrados"
              unit="count"
              currentTotal={snapshot.series.leads.currentTotal}
              previousTotal={snapshot.series.leads.previousTotal}
              delta={snapshot.series.leads.delta}
              current={snapshot.series.leads.current}
              previous={snapshot.series.leads.previous}
              accent="orange"
            />
          </div>
          <div className="col-4">
            <MetricLineCard
              title="Reembolsos concluidos"
              unit="count"
              currentTotal={snapshot.series.refundsProcessed.currentTotal}
              previousTotal={snapshot.series.refundsProcessed.previousTotal}
              delta={snapshot.series.refundsProcessed.delta}
              current={snapshot.series.refundsProcessed.current}
              previous={snapshot.series.refundsProcessed.previous}
              accent="orange"
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-12">
            <div className="card">
              <div className="section-title">Funil</div>
              <div className="grid" style={{ gap: 14 }}>
                <div className="col-6">
                  <BarChart
                    title="Volume por etapa"
                    items={snapshot.funnel.map((step) => ({ label: step.label, value: step.value }))}
                  />
                </div>
                <div className="col-6">
                  <MiniTable
                    title="Queda entre etapas"
                    columns={['Etapa', 'Volume', 'Queda']}
                    rows={snapshot.funnel.map((step) => [
                      step.label,
                      String(step.value),
                      step.drop > 0 ? `${step.drop.toFixed(1)}%` : '-',
                    ])}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="col-6">
            <DonutChart
              title="Objetivo principal"
              items={snapshot.charts.topObjectives.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
            />
          </div>
          <div className="col-6">
            <DonutChart
              title="Renda anual (faixas)"
              items={snapshot.charts.incomeRanges.map((item) => ({
                label: formatAnswer('income_range', item.label),
                value: item.value,
              }))}
            />
          </div>
          <div className="col-6">
            <DonutChart
              title="Vistos mais recomendados"
              items={snapshot.charts.recommendedVisas.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
            />
          </div>
          <div className="col-6">
            <MiniTable
              title="Clientes ativos recentes"
              columns={['Nome', 'Contato', 'Valor', 'Status']}
              rows={snapshot.customers.slice(0, 8).map((customer) => [
                customer.name,
                customer.email,
                customer.activePayment
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getPaymentAmountCents(customer.activePayment) / 100)
                  : '-',
                'Ativo',
              ])}
            />
          </div>
          <div className="col-6">
            <MiniTable
              title="Leads recentes"
              columns={['Nome', 'Contato', 'Gratis', 'Ultimo evento']}
              rows={snapshot.leads.slice(0, 8).map((lead) => [
                lead.name,
                lead.email,
                lead.hasFreeDiagnostic ? 'Concluido' : 'Nao',
                lead.lastEventAt ? formatDateTime(lead.lastEventAt) : formatDateTime(lead.createdAt),
              ])}
            />
          </div>
        </div>
      </div>
    </>
  );
}
