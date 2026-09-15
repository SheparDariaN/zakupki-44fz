export const up = (pgm) => {
  pgm.sql(`
    create table purchase_offers (
      id serial primary key,
      purchase_id integer not null references purchases(id) on delete cascade,
      registered_number text not null,
      registered_date date not null,
      company_name text not null default '',
      counterparty_id integer references counterparties(id) on delete set null,
      file_rel_path text not null,
      mime text not null,
      file_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index purchase_offers_purchase_id_idx on purchase_offers(purchase_id);
    create index purchase_offers_counterparty_id_idx on purchase_offers(counterparty_id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    drop table if exists purchase_offers;
  `);
};
