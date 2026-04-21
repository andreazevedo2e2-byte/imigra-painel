# Imigra Painel

Painel administrativo separado do ImigraPlan (Next.js).

## O que ele faz (MVP)

- Login por **e-mail + senha** (um usuario admin compartilhado via env vars).
- Dashboard: receita/vendas 30d + reembolsos pendentes (via Supabase).
- Leads: lista + detalhe (perfil, pagamentos, reembolsos, free_diagnostics e diagnostico completo).
- Reembolsos: fila + regra de **7 dias (calendario, America/Sao_Paulo)** + botao "Aprovar" (Stripe, direct charge).
- Pagamentos: lista dos ultimos 200.
- Cancelar acesso: atualiza **profiles.has_paid = false** e **auth.user_metadata.has_paid = false**.

## Env vars (Vercel)

Obrigatorias:

- `ADMIN_LOGIN_EMAIL`
- `ADMIN_LOGIN_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Recomendadas:

- `ADMIN_SESSION_SECRET` (>= 16 chars)

Opcionais (para aprovar reembolsos via Stripe):

- `STRIPE_SECRET_KEY` (secret key da plataforma)
- `STRIPE_CONNECT_DESTINATION_ACCOUNT_ID` (acct_... do Rodrigo)

## Rodar local

```bash
npm install
npm run dev
```

Crie um `.env.local` com as env vars acima.

## Supabase SQL

Veja `supabase.sql` para ajustes/colunas esperadas (refund_requests).

