export type Category = { id: number; name: string; icon: string; sortOrder: number }
export type Product = {
  id: number
  categoryId: number
  name: string
  description: string
  price: number
  featured: boolean
  status: 'active' | 'inactive'
  availabilityStatus: 'available' | 'out_of_stock'
  image: string
}
export type PaymentMethod = 'cash_on_pickup' | 'cash_on_delivery'
export type ProductRating = { productId: number; rating: number; ratedAt: string }
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'delivered'
  | 'cancelled'
export type Order = {
  id: number
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  orderType: 'pickup' | 'delivery'
  scheduleType: 'now' | 'later'
  pickupTime: string
  deliveryTime: string
  deliveryAddress: string
  landmark: string
  notes: string
  subtotal: number
  tax: number
  deliveryFee: number
  total: number
  status: OrderStatus
  paymentMethod: PaymentMethod
  createdAt: string
  ratings?: ProductRating[]
  items: Array<{ productId: number; productName: string; productPrice: number; quantity: number; subtotal: number }>
}
export type Staff = { id: number; name: string; role: string; email: string; username: string; password: string; status: 'active' | 'inactive'; isAdmin: boolean }

export const categoriesSeed: Category[] = [
  { id: 1, name: 'Coffee (Hot)', icon: 'bi-cup-hot-fill', sortOrder: 1 },
  { id: 2, name: 'Coffee (Cold)', icon: 'bi-cup-straw', sortOrder: 2 },
  { id: 3, name: 'Non-Coffee Drinks', icon: 'bi-cup', sortOrder: 3 },
  { id: 4, name: 'Pastries', icon: 'bi-bag-fill', sortOrder: 4 },
  { id: 5, name: 'Sandwiches', icon: 'bi-egg-fried', sortOrder: 5 },
  { id: 6, name: 'Desserts', icon: 'bi-cake2-fill', sortOrder: 6 },
  { id: 7, name: 'Add-ons', icon: 'bi-plus-circle', sortOrder: 7 },
]

const productRows: Array<[number, number, string, string, number, boolean, string]> = [
  [1, 1, 'Espresso', 'Rich and bold espresso shot.', 85, true, 'espresso.jpg'],
  [2, 1, 'Americano', 'Espresso diluted with hot water for a smooth taste.', 95, true, 'americano.jpg'],
  [3, 1, 'Cappuccino', 'Espresso with steamed milk and foam.', 120, true, 'cappuccino.jpg'],
  [4, 1, 'Cafe Latte', 'Espresso with silky steamed milk.', 130, true, 'cafe_latte.jpg'],
  [5, 1, 'Mocha', 'Chocolate-flavored latte with espresso.', 140, true, 'mocha.jpg'],
  [6, 1, 'Caramel Macchiato', 'Espresso with milk and caramel drizzle.', 145, true, 'caramel_machiatto.jpg'],
  [7, 2, 'Iced Americano', 'Chilled espresso over ice and water.', 105, true, 'iced_americano.jpg'],
  [8, 2, 'Iced Latte', 'Cold milk and espresso over ice.', 140, true, 'iced_latte.jpg'],
  [9, 2, 'Iced Mocha', 'Iced mocha blend with rich chocolate notes.', 150, true, 'iced-mocha.jpg'],
  [10, 2, 'Cold Brew', 'Slow-steeped coffee served cold.', 140, true, 'cold brew.jpg'],
  [11, 2, 'Vanilla Sweet Cream Cold Brew', 'Cold brew topped with sweet vanilla cream.', 160, true, 'vanilla-sweet-cream-cold-brew.jpg'],
  [12, 3, 'Hot Chocolate', 'Creamy hot cocoa drink.', 110, true, 'hot-chocolate.jpg'],
  [13, 3, 'Matcha Latte', 'Premium matcha with steamed milk.', 140, true, 'matcha_latte.jpg'],
  [14, 3, 'Chai Latte', 'Spiced chai tea with steamed milk.', 130, true, 'chai-latte.avif'],
  [15, 3, 'Iced Matcha', 'Chilled matcha latte over ice.', 145, true, 'iced-matcha.jpg'],
  [16, 3, 'Fresh Lemonade', 'Refreshing house lemonade.', 110, true, 'fresh_lemonade.webp'],
  [17, 3, 'Iced Tea (Peach/Lemon)', 'Iced tea with peach or lemon flavor.', 105, true, 'iced_tea.jpg'],
  [18, 4, 'Butter Croissant', 'Buttery and flaky French pastry.', 75, true, 'butter_croissant.jpg'],
  [19, 4, 'Chocolate Croissant', 'Croissant filled with chocolate.', 90, true, 'chocolate_croissant.jpg'],
  [20, 4, 'Cinnamon Roll', 'Soft roll swirled with cinnamon sugar.', 100, true, 'cinnamon_roll.jpg'],
  [21, 4, 'Blueberry Muffin', 'Moist muffin packed with blueberries.', 85, true, 'blueberry_muffin.jpg'],
  [22, 4, 'Banana Bread Slice', 'Classic homemade banana bread slice.', 80, true, 'banana_bread_slice.jpg'],
  [23, 5, 'Ham and Cheese Sandwich', 'Toasted sandwich with ham and cheese.', 185, true, 'ham_and_cheese_sandwitch.avif'],
  [24, 5, 'Club Sandwich', 'Triple-layer sandwich with bacon and turkey.', 245, true, 'club_sandwitch.jpg'],
  [25, 5, 'Tuna Melt', 'Tuna sandwich with melted cheese.', 205, true, 'tuna_melt.webp'],
  [26, 5, 'Chicken Pesto Panini', 'Grilled panini with chicken and pesto.', 230, true, 'chicken_pesto_panini.jpg'],
  [27, 5, 'Egg Mayo Sandwich', 'Creamy egg mayo in fresh bread.', 170, true, 'egg_mayo_sandwitch.avif'],
  [28, 6, 'Chocolate Lava Cake', 'Warm cake with molten chocolate center.', 175, true, 'chocolate_lava_cake.webp'],
  [29, 6, 'Cheesecake Slice', 'Rich and creamy cheesecake slice.', 160, true, 'cheesecake_slice.jpg'],
  [30, 6, 'Tiramisu Cup', 'Coffee-flavored layered tiramisu dessert.', 165, true, 'tiramisu_cup.webp'],
  [31, 6, 'Brownie Ala Mode', 'Chocolate brownie served with ice cream.', 150, true, 'brownie_ala_mode.webp'],
  [32, 7, 'Extra Espresso Shot', 'Add one extra espresso shot.', 30, false, 'extra_espresso_shot.webp'],
  [33, 7, 'Oat Milk', 'Milk alternative add-on.', 25, false, 'oath_milk.webp'],
  [34, 7, 'Almond Milk', 'Dairy-free almond milk add-on.', 25, false, 'almond_milk.webp'],
  [35, 7, 'Whipped Cream', 'Creamy whipped topping.', 20, false, 'whipped_cream.jpg'],
  [36, 7, 'Caramel Syrup', 'Sweet caramel flavor add-on.', 15, false, 'caramel_syrup.jpg'],
]

export const productsSeed: Product[] = productRows.map(([id, categoryId, name, description, price, featured, image]) => ({
  id,
  categoryId,
  name,
  description,
  price,
  featured,
  image,
  status: 'active',
  availabilityStatus: 'available',
}))

export const staffSeed: Staff[] = [
  { id: 1, name: 'Administrator', role: 'Admin', email: 'jelyliciouscafe@gmail.com', username: 'jireh', password: 'faith', status: 'active', isAdmin: true },
  { id: 2, name: 'Cafe Staff', role: 'Staff', email: 'staff@jelylicious.test', username: 'staff', password: 'staff123', status: 'active', isAdmin: false },
]