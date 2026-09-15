export const up = (pgm) => {
  pgm.sql(`
    create table users (
      id serial primary key,
      username varchar(64) not null unique,
      password text not null,
      role varchar(16) not null default 'user' check (role in ('admin', 'user')),
      must_change_password boolean not null default false,
      settings jsonb not null default '{}'::jsonb
    );

    create table counterparties (
      id serial primary key,
      company_name text not null,
      short_name text not null default '',
      full_name text not null default '',
      director text not null default '',
      director_genitive text not null default '',
      director_dative text not null default '',
      email text not null default '',
      phone text not null default '',
      legal_address text not null default '',
      postal_address text not null default '',
      tags jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table purchases (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      name text not null,
      price numeric(15, 2),
      budget_year integer,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table purchase_links (
      id serial primary key,
      purchase_id integer not null references purchases(id) on delete cascade,
      url text not null,
      title text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table purchase_documents (
      id serial primary key,
      purchase_id integer not null references purchases(id) on delete cascade,
      kind varchar(16) not null check (kind in ('nmck', 'kp', 'memo', 'contract')),
      storage varchar(16) not null check (storage in ('mongo', 'file')),
      mongo_id text,
      file_rel_path text,
      mime text,
      file_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (purchase_id, kind)
    );

    create index users_username_idx on users(username);
    create index purchases_user_id_idx on purchases(user_id);
    create index purchase_links_purchase_id_idx on purchase_links(purchase_id);
    create index purchase_documents_purchase_id_idx on purchase_documents(purchase_id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    drop table if exists purchase_documents;
    drop table if exists purchase_links;
    drop table if exists purchases;
    drop table if exists counterparties;
    drop table if exists users;
  `);
};
