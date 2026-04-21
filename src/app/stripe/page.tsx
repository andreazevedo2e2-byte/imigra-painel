import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { DonutChart, MiniTable, StatCard } from '@/components/dashboard-ui';
import { requireAdminSession } from '@/lib/auth';
import { formatCurrencyBRL, formatDateTime, formatPercent } from '@/lib/admin-presenters';
import { stripePlatform } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function startOfDayUnixSeconds(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

async function getStripeOverview() {
  const { stripe, connectedAccountId } = stripePlatform();
  const gte = startOfDayUnixSeconds(30);

  let gross = 0;
  let refunds = 0;
  let salesCount = 0;
  let refundCount = 0;
  let lastCursor: string | undefined;

  for (;;) {
    const page = await stripe.balanceTransactions.list(
      { limit: 100, created: { gte }, starting_after: lastCursor },
      { stripeAccount: connectedAccountId }
    );

    for (const item of page.data) {
      if (item.type === 'charge') {
        salesCount++;
        gross += item.amount;
      }
      if (item.type === 'refund') {
        refundCount++;
        refunds += Math.abs(item.amount);
      }
    }

    if (!page.has_more) break;
    lastCursor = page.data[page.data.length - 1]?.id;
    if (!lastCursor) break;
  }

  const paymentIntents = await stripe.paymentIntents.list(
    { limit: 30, created: { gte } },
    { stripeAccount: connectedAccountId }
  );

  const recentSales = paymentIntents.data.map((intent) => ({
    createdAt: intent.created ? new Date(intent.created * 1000).toISOString() : null,
    amount: intent.amount_received || intent.amount || 0,
    status:
      intent.status === 'succeeded'
        ? 'Pago'
        : intent.status === 'processing'
          ? 'Em processamento'
          : 'Pendente',
    customer: intent.receipt_email || 'Cliente sem e-mail',
  }));

  return {
    gross,
    salesCount,
    refunds,
    refundCount,
    averageTicket: salesCount ? gross / salesCount : 0,
    refundRate: salesCount ? (refundCount / salesCount) * 100 : 0,
    recentSales,
  };
}

export default async function StripePage() {
  const adminSession = await requireAdminSession();
  if (!adminSession) redirect('/login');

  const data = await getStripeOverview();
  const summary = [
    { label: 'Vendas', value: data.salesCount },
    { label: 'Reembolsos', value: data.refundCount },
  ];

  return (
    <>
      <Nav current="stripe" />
      <div className="container stack">
        <div className="card highlight-panel">
          <div className="eyebrow">Vendas</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>Resumo de vendas</h1>
        </div>

        <div className="grid">
          <div className="col-3">
            <StatCard label="Faturamento 30 dias" value={formatCurrencyBRL(data.gross / 100)} />
          </div>
          <div className="col-3">
            <StatCard label="Numero de vendas" value={String(data.salesCount)} />
          </div>
          <div className="col-3">
            <StatCard label="Ticket medio" value={formatCurrencyBRL(data.averageTicket / 100)} />
          </div>
          <div className="col-3">
            <StatCard label="Taxa de reembolso" value={formatPercent(data.refundRate)} />
          </div>
        </div>

        <div className="grid">
          <div className="col-5">
            <DonutChart title="Vendas x reembolsos nos ultimos 30 dias" items={summary} />
          </div>
          <div className="col-7">
            <MiniTable
              title="Ultimas vendas registradas na Stripe"
              columns={['Cliente', 'Valor', 'Status', 'Data']}
              rows={data.recentSales.map((sale) => [
                sale.customer,
                formatCurrencyBRL(sale.amount / 100),
                sale.status,
                formatDateTime(sale.createdAt),
              ])}
            />
          </div>
        </div>
      </div>
    </>
  );
}
