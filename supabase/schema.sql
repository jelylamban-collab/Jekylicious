create table if not exists categories (
  id bigint primary key,
  name text not null,
  icon text not null,
  sort_order integer not null
);

create table if not exists products (
  id bigint primary key,
  category_id bigint not null references categories(id) on delete cascade,
  name text not null,
  description text not null,
  price numeric not null,
  featured boolean not null default false,
  status text not null,
  availability_status text not null,
  image text not null
);

create table if not exists staff (
  id bigint primary key,
  name text not null,
  role text not null,
  email text not null,
  username text not null,
  password text not null,
  status text not null,
  is_admin boolean not null default false
);

create table if not exists orders (
  id bigint primary key,
  order_number text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  order_type text not null,
  schedule_type text not null,
  pickup_time text not null,
  delivery_time text not null,
  delivery_address text not null,
  landmark text not null,
  notes text not null,
  subtotal numeric not null,
  tax numeric not null,
  delivery_fee numeric not null,
  total numeric not null,
  status text not null,
  payment_method text not null,
  created_at timestamptz not null,
  ratings jsonb not null default '[]'::jsonb,
  items jsonb not null
);

create table if not exists order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id bigint not null references products(id),
  quantity integer not null
);

alter table categories enable row level security;
alter table products enable row level security;
alter table staff enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

do $$
begin
  create policy "public read categories" on categories for select using (true);
  create policy "public write categories" on categories for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "public read products" on products for select using (true);
  create policy "public write products" on products for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "public read staff" on staff for select using (true);
  create policy "public write staff" on staff for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "public read orders" on orders for select using (true);
  create policy "public write orders" on orders for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "public read order_items" on order_items for select using (true);
  create policy "public write order_items" on order_items for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

create or replace function create_order_with_items(order_payload jsonb, items_payload jsonb)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order orders%rowtype;
begin
  insert into orders (
    id, order_number, customer_name, customer_email, customer_phone, order_type, schedule_type,
    pickup_time, delivery_time, delivery_address, landmark, notes, subtotal, tax, delivery_fee,
    total, status, payment_method, created_at, ratings, items
  ) values (
    (order_payload->>'id')::bigint,
    order_payload->>'order_number',
    order_payload->>'customer_name',
    coalesce(order_payload->>'customer_email', ''),
    order_payload->>'customer_phone',
    order_payload->>'order_type',
    order_payload->>'schedule_type',
    coalesce(order_payload->>'pickup_time', ''),
    coalesce(order_payload->>'delivery_time', ''),
    coalesce(order_payload->>'delivery_address', ''),
    coalesce(order_payload->>'landmark', ''),
    coalesce(order_payload->>'notes', ''),
    (order_payload->>'subtotal')::numeric,
    (order_payload->>'tax')::numeric,
    (order_payload->>'delivery_fee')::numeric,
    (order_payload->>'total')::numeric,
    order_payload->>'status',
    order_payload->>'payment_method',
    (order_payload->>'created_at')::timestamptz,
    coalesce(order_payload->'ratings', '[]'::jsonb),
    coalesce(order_payload->'items', '[]'::jsonb)
  ) returning * into created_order;

  insert into order_items (order_id, product_id, quantity)
  select
    created_order.id,
    (item->>'productId')::bigint,
    (item->>'quantity')::integer
  from jsonb_array_elements(coalesce(items_payload, '[]'::jsonb)) as item;

  return created_order;
end;
$$;