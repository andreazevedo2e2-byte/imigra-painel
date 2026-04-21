import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { BarChart, MiniTable, StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatCurrencyBRL, formatDateTime, formatPercent, humanizeIdentifier } from '@/lib/admin-presenters';
import { getDashboardData } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const data = await getDashboardData();
  const incomeAverage = data.totals.averageIncomeReais
    ? formatCurrencyBRL(data.totals.averageIncomeReais)
    : 'Ainda sem base suficiente';

  return (
    <>
      <Nav current="dashboard" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Painel de operacao</div>
          <h1 className="hero-title">Visao clara do que entra, converte e pede reembolso.</h1>
          <p className="muted" style={{ maxWidth: 760, fontSize: 18, lineHeight: 1.5, marginTop: 16 }}>
            Tudo aqui foi traduzido para linguagem de negocio. O painel cruza leads, diagnosticos,
            vendas, relatorios e pedidos de reembolso para voce entender o funil inteiro.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            <span className="pill">Logado como {session.email}</span>
            <span className="pill success">{data.totals.leads} leads na base</span>
            <span className="pill">{formatPercent(data.totals.conversionRate)} de conversao</span>
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
              label="Renda anual media"
              value={incomeAverage}
              hint="Estimativa com base no diagnostico gratuito"
            />
          </div>
          <div className="col-3">
            <StatCard
              label="Vendas reembolsadas"
              value={String(data.totals.refundedSales)}
              hint="Vendas ja revertidas"
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-8">
            <BarChart title="Funil do lead ate a venda" items={data.charts.funnel} />
          </div>
          <div className="col-4">
            <BarChart
              title="Faixa de renda anual mais comum"
              items={data.charts.incomeDistribution.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
              emptyLabel="Ainda nao ha respostas suficientes do diagnostico gratuito."
            />
          </div>
          <div className="col-4">
            <BarChart
              title="Faixa etaria dos leads"
              items={data.charts.ageDistribution.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
            />
          </div>
          <div className="col-4">
            <BarChart
              title="Objetivo principal mais citado"
              items={data.charts.topObjectives.map((item) => ({
                label: humanizeIdentifier(item.label),
                value: item.value,
              }))}
            />
          </div>
          <div className="col-4">
            <BarChart title="Vistos mais recomendados" items={data.charts.recommendedVisas} />
          </div>
          <div className="col-6">
            <BarChart title="Formularios especificos iniciados" items={data.charts.sessionsByVisa} />
          </div>
          <div className="col-6">
            <BarChart title="Relatorios entregues por tipo" items={data.charts.reportsByVisa} />
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
