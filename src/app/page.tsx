import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { BarChart, DonutChart, MiniTable, StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatCurrencyBRL, formatDateTime, formatPercent, humanizeIdentifier } from '@/lib/admin-presenters';
import { getDashboardData } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const data = await getDashboardData();
  const refundBreakdown = [
    { label: 'Vendas concluidas', value: data.totals.sales },
    { label: 'Pedidos de reembolso', value: data.totals.refundRequests },
  ];

  return (
    <>
      <Nav current="dashboard" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Dashboard</div>
          <h1 className="hero-title">Dados gerais</h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <span className="pill">{data.totals.leads} leads</span>
            <span className="pill success">{data.totals.payingClients} clientes pagantes</span>
            <span className="pill">{data.totals.sales} vendas concluidas</span>
          </div>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard
              label="Faturamento total"
              value={formatCurrencyBRL(data.totals.totalRevenueCents / 100)}
              hint={`${data.totals.sales} vendas confirmadas`}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Faturamento no mes"
              value={formatCurrencyBRL(data.totals.monthRevenueCents / 100)}
              hint="Somente vendas concluidas"
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Ticket medio"
              value={formatCurrencyBRL(data.totals.averageTicketCents / 100)}
              hint="Media por venda concluida"
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Taxa de reembolso"
              value={formatPercent(data.totals.refundRate)}
              hint={`${data.totals.refundRequests} pedidos de reembolso`}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Clientes pagantes"
              value={String(data.totals.payingClients)}
              hint={`${formatPercent(data.totals.conversionRate)} dos leads viraram clientes`}
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Leads totais"
              value={String(data.totals.leads)}
              hint="Base completa cadastrada"
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Diagnosticos gratuitos"
              value={String(data.charts.funnel[1]?.value ?? 0)}
              hint="Leads que concluiram o formulario inicial"
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Relatorios gerados"
              value={String(data.charts.funnel[3]?.value ?? 0)}
              hint="Relatorios completos salvos"
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-6">
            <BarChart title="Funil do lead ate a venda" items={data.charts.funnel} />
          </div>
          <div className="col-6">
            <DonutChart title="Vendas x reembolsos" items={refundBreakdown} />
          </div>
          <div className="col-6">
            <DonutChart
              title="Faixa de renda anual mais comum"
              items={data.charts.incomeDistribution.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
              emptyLabel="Ainda nao ha respostas suficientes do diagnostico gratuito."
            />
          </div>
          <div className="col-6">
            <DonutChart
              title="Faixa etaria dos leads"
              items={data.charts.ageDistribution.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
            />
          </div>
          <div className="col-6">
            <DonutChart
              title="Objetivo principal mais citado"
              items={data.charts.topObjectives.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
            />
          </div>
          <div className="col-6">
            <DonutChart title="Vistos mais recomendados" items={data.charts.recommendedVisas} />
          </div>
          <div className="col-6">
            <DonutChart title="Formularios especificos iniciados" items={data.charts.sessionsByVisa} />
          </div>
          <div className="col-6">
            <DonutChart title="Relatorios entregues por tipo" items={data.charts.reportsByVisa} />
          </div>
          <div className="col-6">
            <MiniTable
              title="Leads mais recentes"
              columns={['Lead', 'Contato', 'Status', 'Entrada']}
              rows={data.recent.leads.map((lead) => [
                lead.name,
                lead.email,
                lead.paid ? 'Pagou' : 'Ainda nao pagou',
                formatDateTime(lead.createdAt),
              ])}
            />
          </div>
          <div className="col-6">
            <MiniTable
              title="Vendas mais recentes"
              columns={['Cliente', 'Contato', 'Valor', 'Data']}
              rows={data.recent.sales.map((sale) => [
                sale.customerName,
                sale.customerEmail,
                formatCurrencyBRL(sale.amount / 100),
                formatDateTime(sale.createdAt),
              ])}
            />
          </div>
        </div>
      </div>
    </>
  );
}
