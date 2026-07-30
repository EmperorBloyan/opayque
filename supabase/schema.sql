create extension if not exists pgcrypto;

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  merchant_name text not null,
  created_at timestamptz not null default now()
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

alter table terminals enable row level security;
alter table merchants enable row level security;
alter table transactions enable row level security;
alter table terminal_pairing_codes enable row level security;
