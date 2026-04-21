import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import { stripePlatform } from '@/lib/stripe';

function startOfDayUnixSeconds(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

async function getConnectedAccountMetrics30d() {
  const { stripe, connectedAccountId } = stripePlatform();
  const gte = startOfDayUnixSeconds(30);

  let startingAfter: string | undefined = undefined;
  let gross = 0;
  let fees = 0;
  let net = 0;
  let charges = 0;
  let refunds = 0;
  let seen = 0;

  // Paginate balance transactions (connected account), and compute totals.
  for (;;) {
    const page = await stripe.balanceTransactions.list(
      { limit: 100, created: { gte }, starting_after: startingAfter },
      { stripeAccount: connectedAccountId }
    );

    for (const bt of page.data) {
      seen++;
      // Stripe returns amounts in the currency's smallest unit.
      if (bt.type === 'charge') {
        charges++;
        gross += bt.amount;
        fees += bt.fee ?? 0;
        net += bt.net ?? 0;
      } else if (bt.type === 'refund') {
        refunds++;
        gross += bt.amount; // usually negative
        fees += bt.fee ?? 0;
        net += bt.net ?? 0;
      }
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;

    // Safety cap to avoid long runtimes on huge accounts.
    if (seen > 5000) break;
  }

  return { gross, fees, net, charges, refunds, seen };
}

async function getPlatformFeeRevenue30d() {
  const { stripe } = stripePlatform();
  const gte = startOfDayUnixSeconds(30);

  let startingAfter: string | undefined = undefined;
  let feeRevenue = 0;
  let feeRefunds = 0;
  let seen = 0;

  for (;;) {
    const page = await stripe.balanceTransactions.list({
      limit: 100,
      created: { gte },
      starting_after: startingAfter,
    });

    for (const bt of page.data) {
      seen++;
      if (bt.type === 'application_fee') feeRevenue += bt.amount;
      if (bt.type === 'application_fee_refund') feeRefunds += bt.amount; // negative
    }

    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
    if (seen > 5000) break;
  }

  return { feeRevenue, feeRefunds, seen };
}

async function listRecentPaymentIntents() {
  const { stripe, connectedAccountId } = stripePlatform();
  const gte = startOfDayUnixSeconds(30);
  const page = await stripe.paymentIntents.list(
    { limit: 50, created: { gte } },
    { stripeAccount: connectedAccountId }
  );
  return page.data;
}

export default async function StripePage() {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const [connected, platformFees, intents] = await Promise.all([
    getConnectedAccountMetrics30d(),
    getPlatformFeeRevenue30d(),
    listRecentPaymentIntents(),
  ]);

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <Nav />
      <div className="container">
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.2 }}>Stripe</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Dados reais via Stripe API. Vendas/fees: conta conectada (Rodrigo). Receita da plataforma: application fee.
        </p>

        <div className="grid" style={{ marginTop: 16 }}>
          <div className="card col-4">
            <div className="muted" style={{ fontSize: 12 }}>
              Volume bruto (30d, conectado)
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{brl.format(connected.gross / 100)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              charges: {connected.charges} | refunds: {connected.refunds} | pagescan: {connected.seen}
            </div>
          </div>
          <div className="card col-4">
            <div className="muted" style={{ fontSize: 12 }}>
              Taxas Stripe (30d, conectado)
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{brl.format(connected.fees / 100)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              (essas taxas sao do Rodrigo no modelo direct charge)
            </div>
          </div>
          <div className="card col-4">
            <div className="muted" style={{ fontSize: 12 }}>
              Receita plataforma (30d, application fee)
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>
              {brl.format((platformFees.feeRevenue + platformFees.feeRefunds) / 100)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              fee: {brl.format(platformFees.feeRevenue / 100)} | refunds: {brl.format(platformFees.feeRefunds / 100)}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid rgba(55,65,81,0.5)' }}>
            <div style={{ fontWeight: 900 }}>PaymentIntents (ultimos 30d, conectado)</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Mostrando ate 50 (usei Stripe API direto). Reembolso manual por ID entra na proxima iteracao.
            </div>
          </div>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 12, color: 'rgba(209,213,219,0.75)' }}>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Data</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Valor</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Status</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>ID</th>
                </tr>
              </thead>
              <tbody>
                {intents.map((pi) => (
                  <tr key={pi.id} style={{ borderBottom: '1px solid rgba(55,65,81,0.25)' }}>
                    <td style={{ padding: 12 }} className="muted">
                      {pi.created ? new Date(pi.created * 1000).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td style={{ padding: 12 }}>
                      {brl.format((pi.amount_received ?? pi.amount ?? 0) / 100)}
                    </td>
                    <td style={{ padding: 12 }} className="muted">
                      {pi.status}
                    </td>
                    <td style={{ padding: 12 }} className="muted">
                      {pi.id}
                    </td>
                  </tr>
                ))}
                {intents.length === 0 && (
                  <tr>
                    <td style={{ padding: 12 }} className="muted" colSpan={4}>
                      Nenhum PaymentIntent encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

