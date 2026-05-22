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
  created_at timestamptz not null
);

alter table if exists products add column if not exists image text not null default '';

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

insert into categories (id, name, icon, sort_order) values
  (1, 'Coffee (Hot)', 'bi-cup-hot-fill', 1),
  (2, 'Coffee (Cold)', 'bi-cup-straw', 2),
  (3, 'Non-Coffee Drinks', 'bi-cup', 3),
  (4, 'Pastries', 'bi-bag-fill', 4),
  (5, 'Sandwiches', 'bi-egg-fried', 5),
  (6, 'Desserts', 'bi-cake2-fill', 6),
  (7, 'Add-ons', 'bi-plus-circle', 7)
on conflict (id) do update
set name = excluded.name,
    icon = excluded.icon,
    sort_order = excluded.sort_order;

insert into products (id, category_id, name, description, price, featured, status, availability_status, image) values
  (1, 1, 'Espresso', 'Rich and bold espresso shot.', 85, true, 'active', 'available', 'espresso.jpg'),
  (2, 1, 'Americano', 'Espresso diluted with hot water for a smooth taste.', 95, true, 'active', 'available', 'americano.jpg'),
  (3, 1, 'Cappuccino', 'Espresso with steamed milk and foam.', 120, true, 'active', 'available', 'cappuccino.jpg'),
  (4, 1, 'Cafe Latte', 'Espresso with silky steamed milk.', 130, true, 'active', 'available', 'cafe_latte.jpg'),
  (5, 1, 'Mocha', 'Chocolate-flavored latte with espresso.', 140, true, 'active', 'available', 'mocha.jpg'),
  (6, 1, 'Caramel Macchiato', 'Espresso with milk and caramel drizzle.', 145, true, 'active', 'available', 'caramel_machiatto.jpg'),
  (7, 2, 'Iced Americano', 'Chilled espresso over ice and water.', 105, true, 'active', 'available', 'iced_americano.jpg'),
  (8, 2, 'Iced Latte', 'Cold milk and espresso over ice.', 140, true, 'active', 'available', 'iced_latte.jpg'),
  (9, 2, 'Iced Mocha', 'Iced mocha blend with rich chocolate notes.', 150, true, 'active', 'available', 'iced-mocha.jpg'),
  (10, 2, 'Cold Brew', 'Slow-steeped coffee served cold.', 140, true, 'active', 'available', 'cold brew.jpg'),
  (11, 2, 'Vanilla Sweet Cream Cold Brew', 'Cold brew topped with sweet vanilla cream.', 160, true, 'active', 'available', 'vanilla-sweet-cream-cold-brew.jpg'),
  (12, 3, 'Hot Chocolate', 'Creamy hot cocoa drink.', 110, true, 'active', 'available', 'hot-chocolate.jpg'),
  (13, 3, 'Matcha Latte', 'Premium matcha with steamed milk.', 140, true, 'active', 'available', 'matcha_latte.jpg'),
  (14, 3, 'Chai Latte', 'Spiced chai tea with steamed milk.', 130, true, 'active', 'available', 'chai-latte.avif'),
  (15, 3, 'Iced Matcha', 'Chilled matcha latte over ice.', 145, true, 'active', 'available', 'iced-matcha.jpg'),
  (16, 3, 'Fresh Lemonade', 'Refreshing house lemonade.', 110, true, 'active', 'available', 'fresh_lemonade.webp'),
  (17, 3, 'Iced Tea (Peach/Lemon)', 'Iced tea with peach or lemon flavor.', 105, true, 'active', 'available', 'iced_tea.jpg'),
  (18, 4, 'Butter Croissant', 'Buttery and flaky French pastry.', 75, true, 'active', 'available', 'butter_croissant.jpg'),
  (19, 4, 'Chocolate Croissant', 'Croissant filled with chocolate.', 90, true, 'active', 'available', 'chocolate_croissant.jpg'),
  (20, 4, 'Cinnamon Roll', 'Soft roll swirled with cinnamon sugar.', 100, true, 'active', 'available', 'cinnamon_roll.jpg'),
  (21, 4, 'Blueberry Muffin', 'Moist muffin packed with blueberries.', 85, true, 'active', 'available', 'blueberry_muffin.jpg'),
  (22, 4, 'Banana Bread Slice', 'Classic homemade banana bread slice.', 80, true, 'active', 'available', 'banana_bread_slice.jpg'),
  (23, 5, 'Ham and Cheese Sandwich', 'Toasted sandwich with ham and cheese.', 185, true, 'active', 'available', 'ham_and_cheese_sandwitch.avif'),
  (24, 5, 'Club Sandwich', 'Triple-layer sandwich with bacon and turkey.', 245, true, 'active', 'available', 'club_sandwitch.jpg'),
  (25, 5, 'Tuna Melt', 'Tuna sandwich with melted cheese.', 205, true, 'active', 'available', 'tuna_melt.webp'),
  (26, 5, 'Chicken Pesto Panini', 'Grilled panini with chicken and pesto.', 230, true, 'active', 'available', 'chicken_pesto_panini.jpg'),
  (27, 5, 'Egg Mayo Sandwich', 'Creamy egg mayo in fresh bread.', 170, true, 'active', 'available', 'egg_mayo_sandwitch.avif'),
  (28, 6, 'Chocolate Lava Cake', 'Warm cake with molten chocolate center.', 175, true, 'active', 'available', 'chocolate_lava_cake.webp'),
  (29, 6, 'Cheesecake Slice', 'Rich and creamy cheesecake slice.', 160, true, 'active', 'available', 'cheesecake_slice.jpg'),
  (30, 6, 'Tiramisu Cup', 'Coffee-flavored layered tiramisu dessert.', 165, true, 'active', 'available', 'tiramisu_cup.webp'),
  (31, 6, 'Brownie Ala Mode', 'Chocolate brownie served with ice cream.', 150, true, 'active', 'available', 'brownie_ala_mode.webp'),
  (32, 7, 'Extra Espresso Shot', 'Add one extra espresso shot.', 30, false, 'active', 'available', 'extra_espresso_shot.webp'),
  (33, 7, 'Oat Milk', 'Milk alternative add-on.', 25, false, 'active', 'available', 'oath_milk.webp'),
  (34, 7, 'Almond Milk', 'Dairy-free almond milk add-on.', 25, false, 'active', 'available', 'almond_milk.webp'),
  (35, 7, 'Whipped Cream', 'Creamy whipped topping.', 20, false, 'active', 'available', 'whipped_cream.jpg'),
  (36, 7, 'Caramel Syrup', 'Sweet caramel flavor add-on.', 15, false, 'active', 'available', 'caramel_syrup.jpg')
on conflict (id) do update
set category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    featured = excluded.featured,
    status = excluded.status,
    availability_status = excluded.availability_status,
    image = excluded.image;

insert into staff (id, name, role, email, username, password, status, is_admin) values
  (1, 'Administrator', 'Admin', 'jelyliciouscafe@gmail.com', 'jireh', 'faith', 'active', true),
  (2, 'Cafe Staff', 'Staff', 'staff@jelylicious.test', 'staff', 'staff123', 'active', false)
on conflict (id) do update
set name = excluded.name,
    role = excluded.role,
    email = excluded.email,
    username = excluded.username,
    password = excluded.password,
    status = excluded.status,
    is_admin = excluded.is_admin;
