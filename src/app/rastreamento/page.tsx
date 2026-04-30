import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { BarChart, DonutChart, MiniTable } from '@/components/dashboard-ui';
import { HelpHint } from '@/components/help-hint';
import { MetricLineCard } from '@/components/metric-line-card';
import { formatDateTime } from '@/lib/admin-presenters';
import { requireAdminSession } from '@/lib/auth';
import { getAdminSnapshot } from '@/lib/admin-data';

export const dynamic = 'force-dynamic';

function parsePeriodDays(input: unknown) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (raw === 'all') return 0;
  const days = Number.parseInt(raw, 10);
  if (days === 7 || days === 30 || days === 90) return days;
  return 30;
}

export default async function RastreamentoPage({
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
      <Nav current="tracking" />
      <div className="container stack">
        <div className="card highlight-panel page-head">
          <div>
            <div className="page-title">Rastreamento</div>
            <div className="page-subtitle">
              {periodDays > 0
                ? `Tráfego da landing e passagem pelo checkout nos últimos ${periodDays} dias. Dados aproximados, sem armazenar IP.`
                : 'Tráfego da landing e passagem pelo checkout em todo o período registrado. Dados aproximados, sem armazenar IP.'}
            </div>
          </div>
          <div className="badge-row">
            <span className="pill">Visitantes: <strong>{snapshot.metrics.visitorsPeriod}</strong></span>
            <span className="pill">Paginas vistas: <strong>{snapshot.metrics.pageViewsPeriod}</strong></span>
            <span className="pill warn">Checkout iniciou: <strong>{snapshot.metrics.checkoutStartedPeriod}</strong></span>
            <span className="pill danger">Checkout sem pagar: <strong>{snapshot.metrics.checkoutAbandonedPeriod}</strong></span>
            <span className="pill success">Scroll medio: <strong>{snapshot.metrics.avgScrollDepth.toFixed(0)}%</strong></span>
            <span className="pill">Leads quentes: <strong>{snapshot.tracking.hotLeads.length}</strong></span>
          </div>
        </div>

        <div className="segmented" role="tablist" aria-label="Periodo">
          <Link className={`seg-btn ${periodDays === 7 ? 'active' : ''}`} href="/rastreamento?days=7">7 dias</Link>
          <Link className={`seg-btn ${periodDays === 30 ? 'active' : ''}`} href="/rastreamento?days=30">30 dias</Link>
          <Link className={`seg-btn ${periodDays === 90 ? 'active' : ''}`} href="/rastreamento?days=90">90 dias</Link>
          <Link className={`seg-btn ${periodDays === 0 ? 'active' : ''}`} href="/rastreamento?days=all">Todo o periodo</Link>
        </div>

        <div className="grid">
          <div className="col-6">
            <MetricLineCard
              title="Visitantes unicos"
              unit="count"
              currentTotal={snapshot.series.visitors.currentTotal}
              previousTotal={snapshot.series.visitors.previousTotal}
              delta={snapshot.series.visitors.delta}
              current={snapshot.series.visitors.current}
              previous={snapshot.series.visitors.previous}
              accent="violet"
            />
          </div>
          <div className="col-6">
            <MetricLineCard
              title="Visualizacoes de pagina"
              unit="count"
              currentTotal={snapshot.series.pageViews.currentTotal}
              previousTotal={snapshot.series.pageViews.previousTotal}
              delta={snapshot.series.pageViews.delta}
              current={snapshot.series.pageViews.current}
              previous={snapshot.series.pageViews.previous}
              accent="orange"
            />
          </div>
          <div className="col-6">
            <MetricLineCard
              title="Checkout iniciado"
              unit="count"
              currentTotal={snapshot.series.checkoutStarted.currentTotal}
              previousTotal={snapshot.series.checkoutStarted.previousTotal}
              delta={snapshot.series.checkoutStarted.delta}
              current={snapshot.series.checkoutStarted.current}
              previous={snapshot.series.checkoutStarted.previous}
              accent="violet"
            />
          </div>
          <div className="col-6">
            <MetricLineCard
              title="Checkout sem pagamento"
              unit="count"
              currentTotal={snapshot.series.checkoutAbandoned.currentTotal}
              previousTotal={snapshot.series.checkoutAbandoned.previousTotal}
              delta={snapshot.series.checkoutAbandoned.delta}
              current={snapshot.series.checkoutAbandoned.current}
              previous={snapshot.series.checkoutAbandoned.previous}
              accent="orange"
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-4">
            <div className="card stat-card">
              <div className="eyebrow">Visitantes que clicaram em CTA</div>
              <div className="stat-value">{snapshot.metrics.ctaClicksPeriod}</div>
              <div className="muted stat-hint">Conta visitantes unicos, nao quantidade bruta de cliques.</div>
            </div>
          </div>
          <div className="col-4">
            <div className="card stat-card">
              <div className="eyebrow">Scroll medio</div>
              <div className="stat-value">{snapshot.metrics.avgScrollDepth.toFixed(0)}%</div>
              <div className="muted stat-hint">Maior profundidade media por visita.</div>
            </div>
          </div>
          <div className="col-4">
            <div className="card stat-card">
              <div className="eyebrow" style={{ display: 'flex', alignItems: 'center' }}>
                Leads quentes
                <HelpHint label="Visitantes com sinais fortes de interesse: leitura profunda, clique em CTA e navegacao consistente. Serve para priorizacao comercial." />
              </div>
              <div className="stat-value">{snapshot.tracking.hotLeads.length}</div>
              <div className="muted stat-hint">Indicador de prioridade comercial.</div>
            </div>
          </div>
          <div className="col-4">
            <div className="card stat-card">
              <div className="eyebrow">Checkout concluido</div>
              <div className="stat-value">{snapshot.metrics.checkoutRecoveredPeriod}</div>
              <div className="muted stat-hint">Sessoes iniciadas que viraram pagamento.</div>
            </div>
          </div>
        </div>

        <div className="grid">
          <div className="col-6">
            <BarChart title="Paginas mais acessadas" items={snapshot.charts.topPaths} />
          </div>
          <div className="col-6">
            <BarChart title="CTAs mais acionados" items={snapshot.charts.topClicks} />
          </div>
          <div className="col-4">
            <DonutChart title="Paises" items={snapshot.charts.countries} />
          </div>
          <div className="col-4">
            <DonutChart title="Regioes" items={snapshot.charts.regions} />
          </div>
          <div className="col-4">
            <DonutChart title="Cidades" items={snapshot.charts.cities} />
          </div>
          <div className="col-6">
            <DonutChart title="Dispositivo de acesso" items={snapshot.charts.devices} />
          </div>
        </div>

        <div className="grid">
          <div className="col-12">
            <MiniTable
              title="Checkout aberto e abandonado"
              columns={['Pessoa', 'Contato', 'Destino', 'Abriu checkout', 'Tempo sem pagar']}
              rows={snapshot.tracking.checkoutAbandoned.map((lead) => [
                lead.name,
                lead.email,
                lead.lastIntent,
                formatDateTime(lead.startedAt),
                `${lead.ageMinutes} min`,
              ])}
              emptyLabel="Nenhum checkout abandonado identificado no periodo."
            />
          </div>
          <div className="col-12">
            <MiniTable
              title="Taxa de abandono por pagina"
              columns={['Pagina', 'Visualizacoes', 'Saidas estimadas', 'Abandono']}
              rows={snapshot.tracking.abandonment.map((item) => [
                item.path,
                String(item.views),
                String(item.exits),
                `${item.rate.toFixed(1)}%`,
              ])}
              emptyLabel="Ainda nao ha dados suficientes de navegacao."
            />
          </div>
          <div className="col-12">
            <MiniTable
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Leads quentes
                  <HelpHint label="Prioridade mais alta significa comportamento mais proximo de compra. Hoje o score usa profundidade de leitura, clique em CTA e consistencia da visita." />
                </span>
              }
              columns={['Pessoa', 'Contato', 'Prioridade', 'Ultima pagina', 'Local aproximado', 'Ultimo evento']}
              rows={snapshot.tracking.hotLeads.map((lead) => [
                lead.name,
                lead.email,
                `${lead.score}/100`,
                lead.lastPath,
                lead.city ? `${lead.city}, ${lead.country}` : lead.country,
                formatDateTime(lead.lastEventAt),
              ])}
              emptyLabel="Nenhum lead quente identificado no periodo."
            />
          </div>
        </div>
      </div>
    </>
  );
}

