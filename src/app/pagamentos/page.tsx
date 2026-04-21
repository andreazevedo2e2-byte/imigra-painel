import { redirect } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

async function getPayments() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('Failed to load payments:', error);
    return [];
  }
  return data ?? [];
}

export default async function PagamentosPage() {
  const session = await requireAdminSession();
  if (!session) redirect('/login');

  const payments = await getPayments();
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <Nav />
      <div className="container">
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.2 }}>Pagamentos</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Ultimos 200 registros em payments.
        </p>

        <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 12, color: 'rgba(209,213,219,0.75)' }}>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Data</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>User</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Valor</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Status</th>
                  <th style={{ padding: 12, borderBottom: '1px solid rgba(55,65,81,0.6)' }}>Stripe PI</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(55,65,81,0.25)' }}>
                    <td style={{ padding: 12 }} className="muted">
                      {p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td style={{ padding: 12, fontWeight: 700 }}>{p.user_id?.slice?.(0, 8) ?? '—'}</td>
                    <td style={{ padding: 12 }}>{brl.format((p.amount ?? 0) / 100)}</td>
                    <td style={{ padding: 12 }} className="muted">
                      {p.status ?? '—'}
                    </td>
                    <td style={{ padding: 12 }} className="muted">
                      {p.stripe_payment_intent_id ?? '—'}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td style={{ padding: 12 }} className="muted" colSpan={5}>
                      Nenhum pagamento encontrado.
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
