-- Nivora Notes sync schema for Neon / PostgreSQL 13+.
-- Safe to run more than once. The server NEVER stores plaintext notes, tasks or passwords:
-- `payload` is an end-to-end encrypted blob produced on the device.

create extension if not exists pgcrypto;

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  auth_salt   text not null,
  auth_hash   text not null,
  created_at  timestamptz not null default now()
);

create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null unique,
  device      text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked     boolean not null default false
);
create index if not exists sessions_user_idx on sessions(user_id);

create sequence if not exists records_rev_seq;

create table if not exists records (
  user_id           uuid not null references users(id) on delete cascade,
  kind              text not null check (kind in ('note','task','category','reminder','vault')),
  id                text not null,
  payload           text not null default '',
  deleted           boolean not null default false,
  client_updated_at bigint not null default 0,
  rev               bigint not null,
  updated_at        timestamptz not null default now(),
  primary key (user_id, kind, id)
);
create index if not exists records_user_rev_idx on records(user_id, rev);
