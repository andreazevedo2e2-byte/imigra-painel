-- Imigra Painel (Admin) - SQL helper
-- Execute no Supabase SQL editor do projeto do ImigraPlan.

-- 1) Refund requests: garantir colunas esperadas pelo ImigraPlan + Painel
alter table if exists public.refund_requests
  add column if not exists payment_id uuid;

alter table if exists public.refund_requests
  add column if not exists stripe_payment_intent_id text;

alter table if exists public.refund_requests
  add column if not exists stripe_refund_id text;

alter table if exists public.refund_requests
  add column if not exists processed_at timestamptz;

alter table if exists public.refund_requests
  add column if not exists error_message text;

alter table if exists public.refund_requests
  add column if not exists ip text;

-- FK (se payments existir)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'payments'
  ) then
    begin
      alter table public.refund_requests
        add constraint refund_requests_payment_id_fkey
        foreign key (payment_id) references public.payments(id)
        on delete set null;
    exception when duplicate_object then
      -- ignore
    end;
  end if;
end $$;

create index if not exists idx_refund_requests_payment_id on public.refund_requests(payment_id);
create index if not exists idx_refund_requests_user_id on public.refund_requests(user_id);
create index if not exists idx_refund_requests_status on public.refund_requests(status);

-- 2) Auditoria do admin (opcional, recomendado)
create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_email text not null,
  action text not null,
  target_user_id uuid,
  metadata jsonb
);

create index if not exists idx_admin_audit_created_at on public.admin_audit(created_at desc);
create index if not exists idx_admin_audit_action on public.admin_audit(action);

