import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { BarChart, DonutChart, MiniTable, StatCard } from '@/components/dashboard-ui';
import { formatAnswer, formatCurrencyBRL, formatDateTime, formatPercent, humanizeIdentifier } from '@/lib/admin-presenters';
import { requireAdminSession } from '@/lib/auth';
import { getAdminSnapshot, getPaymentAmountCents } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const snapshot = await getAdminSnapshot();

  return (
    <>
      <Nav current="dashboard" />
      <div className="container stack">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 10 }}>Dashboard</div>
          <div className="muted">Periodo padrao: ultimos 30 dias</div>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Leads" value={String(snapshot.metrics.leadsPeriod)} hint="Entradas no periodo" />
          </div>
          <div className="col-3">
            <StatCard
              label="Clientes ativos"
              value={String(snapshot.metrics.activeCustomersNow)}
              hint={`Clientes no periodo: ${snapshot.metrics.customersPeriod}`}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Vendas concluidas"
              value={String(snapshot.metrics.periodSales)}
              hint={`Total historico: ${snapshot.metrics.completedSales}`}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Receita bruta"
              value={formatCurrencyBRL(snapshot.metrics.revenueBrutaPeriodCents / 100)}
              hint={`Historico: ${formatCurrencyBRL(snapshot.metrics.revenueBrutaCents / 100)}`}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Conversao lead -> cliente"
              value={formatPercent(snapshot.metrics.conversionLeadToCustomer)}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Reembolsos pendentes"
              value={String(snapshot.metrics.refundPendingCount)}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Taxa de reembolso"
              value={formatPercent(snapshot.metrics.refundRate)}
              hint={`Concluidos: ${snapshot.metrics.refundProcessedCount}`}
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-6">
            <BarChart
              title="Funil"
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
                step.drop > 0 ? formatPercent(step.drop) : '-',
              ])}
            />
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
              title="Renda anual aproximada"
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
                customer.activePayment ? formatCurrencyBRL(getPaymentAmountCents(customer.activePayment) / 100) : '-',
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
