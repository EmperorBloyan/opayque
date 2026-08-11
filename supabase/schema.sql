create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  password_hash text,
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'completed')),
  wallet_address text not null unique,
  merchant_name text not null,
  merchant_logo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  environment text not null check (environment in ('mainnet', 'sandbox')),
  prefix text not null,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  environment text not null check (environment in ('mainnet', 'sandbox')),
  endpoint_url text not null,
  secret_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists terminals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  terminal_label text not null,
  device_token text not null unique,
  status text not null default 'offline',
  last_active timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  terminal_id uuid references terminals(id) on delete set null,
  signature text,
  token_symbol text not null,
  amount numeric not null default 0,
  status text not null default 'pending',
  payload_hash text,
  created_at timestamptz not null default now()
);

create table if not exists terminal_pairing_codes (
  code text primary key,
  merchant_id uuid,
  terminal_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING', 'USED', 'EXPIRED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create trigger merchants_set_updated_at
  before update on merchants
  for each row execute function set_updated_at();

create trigger webhooks_set_updated_at
  before update on webhooks
  for each row execute function set_updated_at();

alter table merchants enable row level security;
alter table api_keys enable row level security;
alter table webhooks enable row level security;
alter table terminals enable row level security;
alter table transactions enable row level security;
alter table terminal_pairing_codes enable row level security;

create policy "Authenticated merchant can manage own profile"
  on merchants
  for all
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "Merchant owners can manage api keys"
  on api_keys
  for all
  using (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  )
  with check (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  );

create policy "Merchant owners can manage webhooks"
  on webhooks
  for all
  using (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  )
  with check (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  )
create table if not exists terminals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  terminal_label text not null,
  device_token text not null unique,
  status text not null default 'offline',
  last_active timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  terminal_id uuid references terminals(id) on delete set null,
  signature text,
  token_symbol text not null,
  amount numeric not null default 0,
  status text not null default 'pending',
  payload_hash text,
  created_at timestamptz not null default now()
);

create table if not exists terminal_pairing_codes (
  code text primary key,
  merchant_id uuid,
  terminal_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING', 'USED', 'EXPIRED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create trigger merchants_set_updated_at
  before update on merchants
  for each row execute function set_updated_at();

create trigger webhooks_set_updated_at
  before update on webhooks
  for each row execute function set_updated_at();

alter table merchants enable row level security;
alter table api_keys enable row level security;
alter table webhooks enable row level security;
alter table terminals enable row level security;
alter table transactions enable row level security;
alter table terminal_pairing_codes enable row level security;

create policy "Authenticated merchant can manage own profile"
  on merchants
  for all
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "Merchant owners can manage api keys"
  on api_keys
  for all
  using (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  )
  with check (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  );

create policy "Merchant owners can manage webhooks"
  on webhooks
  for all
  using (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  )
  with check (
    merchant_id in (
      select id from merchants where auth_user_id = auth.uid()
    )
  );
