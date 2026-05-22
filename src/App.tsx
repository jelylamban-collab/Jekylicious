import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

import {
  categoriesSeed,
  productsSeed,
  staffSeed,
  type Category,
  type Order,
  type OrderStatus,
  type PaymentMethod,
  type Product,
  type Staff,
} from './sharedData'
import { supabase } from './lib/supabase'

type CartItem = Product & { quantity: number }
type Page =
  | 'home'
  | 'menu'
  | 'cart'
  | 'checkout'
  | 'confirm'
  | 'track'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-orders'
  | 'admin-order-view'
  | 'admin-products'
  | 'admin-product-form'
  | 'admin-categories'
  | 'admin-staff'
  | 'admin-staff-form'
  | 'admin-reports'

const TAX_RATE = 0
const imageAssets = import.meta.glob<string>('./assets/images/**/*.{png,jpg,jpeg,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})
const asset = (path: string) => imageAssets[`./assets/images/${path.replace(/^\/+/, '')}`] || ''
const imageSrc = (value: string) => /^https?:\/\//i.test(value) || value.startsWith('data:') ? value : asset(`uploads/${value.replace(/^\/+/, '')}`)
const peso = (value: number) => `₱${Number(value || 0).toFixed(2)}`
const statusLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase())
const paymentLabel = (value: PaymentMethod) => value === 'cash_on_pickup' ? 'Cash on Pickup' : 'Cash on Delivery'
const orderDone = (status: OrderStatus) => status === 'completed' || status === 'delivered'
type RatingSummary = Record<number, { average: number; count: number }>
function buildRatingSummary(orders: Order[]) {
  const rows = new Map<number, { total: number; count: number }>()
  orders.forEach((order) => {
    if (!orderDone(order.status)) return
    order.ratings?.forEach((rating) => {
      const current = rows.get(rating.productId) || { total: 0, count: 0 }
      rows.set(rating.productId, { total: current.total + rating.rating, count: current.count + 1 })
    })
  })
  return [...rows.entries()].reduce<RatingSummary>((summary, [productId, row]) => {
    summary[productId] = { average: row.total / row.count, count: row.count }
    return summary
  }, {})
}
const nowInput = (plusMinutes = 0) => {
  const date = new Date(Date.now() + plusMinutes * 60000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
const deliveryFees: Record<string, number> = { camias: 10, ulbujan: 15, canguha: 15, sohoton: 20, desamparados: 20 }

type SupabaseSyncOptions<T extends any[]> = {
  table: string
  seed: T
  load: (row: any) => T[number]
  save: (value: T) => any[]
  storageKey?: string
}

function useSupabaseState<T extends any[]>({ table, seed, load, save, storageKey }: SupabaseSyncOptions<T>) {
  const [value, setValue] = useState<T>(() => {
    if (!storageKey) return seed
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as T) : seed
    } catch {
      return seed
    }
  })
  const ready = useRef(false)
  const client = supabase

  useEffect(() => {
    if (!client) {
      ready.current = true
      return
    }
    let cancelled = false
    const refreshFromTable = async () => {
      try {
        const response = await client.from(table).select('*')
        if (response.error) return
        const fetched = response.data || []
        const data = fetched.length ? fetched.map(load) : seed
        if (!cancelled) {
          setValue(data as T)
          if (storageKey) localStorage.setItem(storageKey, JSON.stringify(data))
        }
      } catch {
        // Keep the seed data when the API is unavailable.
      } finally {
        if (!cancelled) ready.current = true
      }
    }
    const refresh = () => { void refreshFromTable() }
    void refreshFromTable()

    const channel = client
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
      .subscribe()

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      void client.removeChannel(channel)
    }
  }, [client, load, table])

  useEffect(() => {
    if (!ready.current || !client) return
    const persist = async () => {
      await client.from(table).delete().neq('id', 0)
      const rows = save(value)
      if (rows.length) await client.from(table).insert(rows)
    }
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(value))
    void persist().catch(() => {})
  }, [client, save, storageKey, table, value])

  return [value, setValue] as const
}

function useLocalState<T>(key: string, seed: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : seed
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue] as const
}

const mapCategoryFromDb = (row: any): Category => ({ id: row.id, name: row.name, icon: row.icon, sortOrder: row.sort_order })
const mapProductFromDb = (row: any): Product => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  featured: Boolean(row.featured),
  status: row.status,
  availabilityStatus: row.availability_status,
  image: row.image,
})
const mapStaffFromDb = (row: any): Staff => ({
  id: row.id,
  name: row.name,
  role: row.role,
  email: row.email,
  username: row.username,
  password: row.password,
  status: row.status,
  isAdmin: Boolean(row.is_admin),
})
const mapOrderItemFromDb = (row: any, product?: Product): Order['items'][number] => ({
  productId: row.product_id,
  productName: product?.name || `Product #${row.product_id}`,
  productPrice: product?.price || 0,
  quantity: Number(row.quantity),
  subtotal: (product?.price || 0) * Number(row.quantity),
})
const mapOrderFromDb = (row: any, items: Order['items'] = []): Order => ({
  id: row.id,
  orderNumber: row.order_number,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  orderType: row.order_type,
  scheduleType: row.order_type === 'delivery' ? 'later' : 'now',
  pickupTime: row.pickup_time || '',
  deliveryTime: row.delivery_time || '',
  deliveryAddress: row.delivery_address,
  landmark: row.landmark,
  notes: row.notes,
  subtotal: Number(row.subtotal),
  tax: Number(row.tax),
  deliveryFee: Number(row.delivery_fee),
  total: Number(row.total),
  status: row.status,
  paymentMethod: row.payment_method,
  createdAt: row.created_at,
  ratings: Array.isArray(row.ratings) ? row.ratings : [],
  items: items.length ? items : (Array.isArray(row.items) ? row.items : []),
})

const saveOrderHeaderRows = (rows: Order[]) => rows.map((row) => ({
  id: row.id,
  order_number: row.orderNumber,
  customer_name: row.customerName,
  customer_email: row.customerEmail,
  customer_phone: row.customerPhone,
  order_type: row.orderType,
  schedule_type: row.scheduleType,
  pickup_time: row.pickupTime || '',
  delivery_time: row.deliveryTime || '',
  delivery_address: row.deliveryAddress,
  landmark: row.landmark,
  notes: row.notes,
  subtotal: row.subtotal,
  tax: row.tax,
  delivery_fee: row.deliveryFee,
  total: row.total,
  status: row.status,
  payment_method: row.paymentMethod,
  created_at: row.createdAt,
  ratings: row.ratings || [],
  items: row.items,
}))

async function insertOrderIntoSupabase(order: Order) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const orderRow = saveOrderHeaderRows([order])[0]

  // Server-side guard: prevent inserting orders scheduled in the past
  const scheduled = order.orderType === 'delivery' ? order.deliveryTime : order.pickupTime || order.createdAt
  if (order.scheduleType === 'later' && scheduled) {
    const scheduledTs = new Date(scheduled).getTime()
    if (isNaN(scheduledTs) || scheduledTs < Date.now()) throw new Error('Scheduled time cannot be in the past.')
  }

  const rpcResponse = await supabase.rpc('create_order_with_items', {
    order_payload: orderRow,
    items_payload: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  })
  if (!rpcResponse.error && rpcResponse.data) {
    const rpcOrder = Array.isArray(rpcResponse.data) ? rpcResponse.data[0] : rpcResponse.data
    if (rpcOrder) return mapOrderFromDb(rpcOrder, order.items)
  }

  const orderInsert = await supabase
    .from('orders')
    .insert(orderRow)
    .select('*')
    .single()
  if (orderInsert.error) {
    throw (rpcResponse.error || orderInsert.error)
  }

  return mapOrderFromDb(orderInsert.data, order.items)
}

const saveCategoryRows = (rows: Category[]) => rows.map((row) => ({ id: row.id, name: row.name, icon: row.icon, sort_order: row.sortOrder }))
const saveProductRows = (rows: Product[]) => rows.map((row) => ({ id: row.id, category_id: row.categoryId, name: row.name, description: row.description, price: row.price, featured: row.featured, status: row.status, availability_status: row.availabilityStatus, image: row.image }))
const saveStaffRows = (rows: Staff[]) => rows.map((row) => ({ id: row.id, name: row.name, role: row.role, email: row.email, username: row.username, password: row.password, status: row.status, is_admin: row.isAdmin }))
function useSupabaseOrders(seed: Order[]) {
  const [value, setValue] = useState<Order[]>(seed)
  const [ready, setReady] = useState(false)
  const client = supabase

  useEffect(() => {
    if (!client) {
      setReady(true)
      return
    }
    let cancelled = false
    const refreshFromTables = async () => {
      try {
        const [ordersResponse, itemsResponse, productsResponse] = await Promise.all([
          client.from('orders').select('*'),
          client.from('order_items').select('*'),
          client.from('products').select('*'),
        ])
        if (ordersResponse.error) return
        const itemRows = itemsResponse.error ? [] : (itemsResponse.data || [])
        const productRows = productsResponse.error ? [] : (productsResponse.data || [])
        const productsById = new Map<number, Product>()
        productRows.forEach((row: any) => productsById.set(row.id, mapProductFromDb(row)))
        const itemsByOrder = new Map<number, Order['items']>()
        itemRows.forEach((row: any) => {
          const current = itemsByOrder.get(row.order_id) || []
          current.push(mapOrderItemFromDb(row, productsById.get(row.product_id)))
          itemsByOrder.set(row.order_id, current)
        })
        const data = (ordersResponse.data || []).map((row: any) => mapOrderFromDb(row, itemsByOrder.get(row.id) || []))
        if (!cancelled) setValue(data.length ? (data as Order[]) : seed)
      } catch {
        // Keep the seed data when Supabase is unavailable or the schema is incomplete.
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    const refresh = () => { void refreshFromTables() }
    void refreshFromTables()

    const ordersChannel = client.channel('orders-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh).subscribe()
    const itemsChannel = client.channel('order-items-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refresh).subscribe()
    const productsChannel = client.channel('order-products-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh).subscribe()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      void client.removeChannel(ordersChannel)
      void client.removeChannel(itemsChannel)
      void client.removeChannel(productsChannel)
    }
  }, [client, seed])

  useEffect(() => {
    if (!ready || !client) return
  }, [client, ready, value])

  return [value, setValue] as const
}

function App() {
  const [page, setPage] = useState<Page>('home')
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [editProductId, setEditProductId] = useState<number | null>(null)
  const [editStaffId, setEditStaffId] = useState<number | null>(null)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [confirmOrderNumber, setConfirmOrderNumber] = useState('')
  const [trackingOrderNumber, setTrackingOrderNumber] = useState('')
  const [toast, setToast] = useState('')
  const [categories, setCategories] = useSupabaseState<Category[]>({ table: 'categories', seed: categoriesSeed, load: mapCategoryFromDb, save: saveCategoryRows })
  const [products, setProducts] = useSupabaseState<Product[]>({ table: 'products', seed: productsSeed, load: mapProductFromDb, save: saveProductRows, storageKey: 'jc_products' })
  const [orders, setOrders] = useSupabaseOrders([])
  const [staff, setStaff] = useSupabaseState<Staff[]>({ table: 'staff', seed: staffSeed, load: mapStaffFromDb, save: saveStaffRows })
  const [cart, setCart] = useLocalState<CartItem[]>('jc_cart', [])
  const [user, setUser] = useLocalState<Staff | null>('jc_user', null)

  const activeProducts = products.filter((p) => p.status === 'active')
  const ratingSummary = buildRatingSummary(orders)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100

  function go(next: Page) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setPage(next)
  }

  function addToCart(product: Product, quantity: number) {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id)
      if (existing) return items.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item))
      return [...items, { ...product, quantity }]
    })
    setToast(`"${product.name}" added!`)
    setTimeout(() => setToast(''), 2500)
  }

  async function placeOrder(form: CheckoutForm) {
    const fee = form.orderType === 'delivery' ? feeForAddress(form.deliveryAddress) : 0
    const orderSubtotal = subtotal
    const nextOrder: Order = {
      id: Date.now(),
      orderNumber: `BH-${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      customerPhone: form.customerPhone,
      orderType: form.orderType,
      scheduleType: form.scheduleType,
      pickupTime: form.orderType === 'pickup' ? form.pickupTime : '',
      deliveryTime: form.orderType === 'delivery' ? form.deliveryTime : '',
      deliveryAddress: form.orderType === 'delivery' ? form.deliveryAddress : '',
      landmark: form.orderType === 'delivery' ? form.landmark : '',
      notes: form.notes,
      subtotal: orderSubtotal,
      tax,
      deliveryFee: fee,
      total: orderSubtotal + tax + fee,
      status: 'pending',
      paymentMethod: form.paymentMethod,
      createdAt: new Date().toISOString(),
      ratings: [],
      items: cart.map((item) => ({ productId: item.id, productName: item.name, productPrice: item.price, quantity: item.quantity, subtotal: item.price * item.quantity })),
    }
    try {
      const savedOrder = await insertOrderIntoSupabase(nextOrder)
      setOrders((rows) => [savedOrder, ...rows])
      setCart([])
      setConfirmOrderNumber(savedOrder.orderNumber)
      go('confirm')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Supabase error'
      console.error('Failed to save order to Supabase:', error)
      setToast(`Order could not be saved to Supabase: ${message}`)
      setTimeout(() => setToast(''), 4000)
    }
  }

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    const nextOrders = orders.map((order) => (order.id === orderId ? { ...order, status } : order))
    setOrders(nextOrders)

    if (!supabase) return

    const response = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (response.error) {
      setOrders(orders)
      throw response.error
    }
  }

  function adminGo(next: Page) {
    if (!user && next !== 'admin-login') return go('admin-login')
    setAdminMenuOpen(false)
    go(next)
  }

  async function updateOrderInSupabase(orderId: number, patch: Partial<Pick<Order, 'status' | 'ratings'>>) {
    if (!supabase) return
    const response = await supabase.from('orders').update(patch).eq('id', orderId)
    if (response.error) throw response.error
  }

  async function updateProductAvailability(productId: number, availabilityStatus: Product['availabilityStatus']) {
    const nextProducts = products.map((product) => (product.id === productId ? { ...product, availabilityStatus } : product))
    setProducts(nextProducts)

    if (!supabase) return

    const response = await supabase.from('products').update({ availability_status: availabilityStatus }).eq('id', productId)
    if (response.error) {
      setProducts(products)
      throw response.error
    }
  }

  const publicProps = { go, cartCount, page }
  const adminProps = { go: adminGo, user, page, logout: () => { setUser(null); go('admin-login') } }

  return (
    <>
      {page.startsWith('admin') ? (
        page === 'admin-login' ? (
          <AdminLogin go={go} staff={staff} setUser={setUser} />
        ) : (
          <AdminShell {...adminProps} menuOpen={adminMenuOpen} setMenuOpen={setAdminMenuOpen}>
            {page === 'admin-dashboard' && <Dashboard orders={orders} products={products} staff={staff} ratingSummary={ratingSummary} go={adminGo} setSelectedOrderId={setSelectedOrderId} />}
            {(page === 'admin-orders') && <AdminOrders orders={orders} setOrders={setOrders} go={adminGo} setSelectedOrderId={setSelectedOrderId} />}
            {page === 'admin-order-view' && <OrderView order={orders.find((o) => o.id === selectedOrderId) || orders[0]} go={adminGo} canManage={!user?.isAdmin} updateOrderStatus={updateOrderStatus} />}
            {page === 'admin-products' && <AdminProducts products={products} categories={categories} ratingSummary={ratingSummary} updateProductAvailability={updateProductAvailability} go={adminGo} setEditProductId={setEditProductId} />}
            {page === 'admin-product-form' && <ProductForm product={products.find((p) => p.id === editProductId)} categories={categories} setProducts={setProducts} go={adminGo} />}
            {page === 'admin-categories' && <Categories categories={categories} setCategories={setCategories} products={products} />}
            {page === 'admin-staff' && <StaffPage staff={staff} setStaff={setStaff} go={adminGo} setEditStaffId={setEditStaffId} />}
            {page === 'admin-staff-form' && <StaffForm member={staff.find((s) => s.id === editStaffId)} setStaff={setStaff} go={adminGo} />}
            {page === 'admin-reports' && <Reports orders={orders} products={products} ratingSummary={ratingSummary} />}
          </AdminShell>
        )
      ) : (
        <>
          <Header {...publicProps} />
          {page === 'home' && <Home products={activeProducts} ratingSummary={ratingSummary} addToCart={addToCart} go={go} />}
          {page === 'menu' && <Menu products={activeProducts} categories={categories} ratingSummary={ratingSummary} addToCart={addToCart} go={go} cartCount={cartCount} subtotal={subtotal} />}
          {page === 'cart' && <Cart cart={cart} setCart={setCart} go={go} subtotal={subtotal} tax={tax} />}
          {page === 'checkout' && <Checkout cart={cart} go={go} subtotal={subtotal} tax={tax} placeOrder={placeOrder} />}
          {page === 'confirm' && <Confirm order={orders.find((o) => o.orderNumber === confirmOrderNumber) || orders[0]} go={go} setTrackingOrderNumber={setTrackingOrderNumber} />}
          {page === 'track' && <Track orders={orders} setOrders={setOrders} initialOrderNumber={trackingOrderNumber} updateOrderInSupabase={updateOrderInSupabase} />}
          <Footer go={go} />
          {toast && <div className="cafe-toast floating-toast"><span className="toast-icon"><i className="bi bi-check-circle-fill"></i></span>{toast}</div>}
        </>
      )}
    </>
  )
}

function Header({ go, cartCount, page }: { go: (p: Page) => void; cartCount: number; page: Page }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [page])

  return (
    <nav className="navbar">
      <div className="container nav-inner">
        <button className="navbar-brand bare" onClick={() => go('admin-login')} title="Staff and admin login">
          <img src={asset('logo1.png')} alt="Jekylicious Cafe" />
          <span>Jekylicious</span>
        </button>
        <div className="nav-actions">
          <button
            className="nav-toggle bare"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
          </button>
          <button className="cart-btn bare" onClick={() => go('cart')}>
            <i className="bi bi-bag-fill"></i> <span className="cart-btn-text">Order Bag</span> {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
        <div className={`nav-menu ${menuOpen ? 'open' : ''}`}>
          <button className={`nav-link ${page === 'home' ? 'active' : ''}`} onClick={() => { setMenuOpen(false); go('home') }}>Home</button>
          <button className={`nav-link ${page === 'menu' ? 'active' : ''}`} onClick={() => { setMenuOpen(false); go('menu') }}>Full Menu</button>
          <button className={`nav-link ${page === 'track' ? 'active' : ''}`} onClick={() => { setMenuOpen(false); go('track') }}>Track Order</button>
        </div>
      </div>
    </nav>
  )
}

function Footer({ go }: { go: (p: Page) => void }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <button className="footer-brand bare" onClick={() => go('admin-login')}>
              <img src={asset('logo1.png')} alt="" /> Jekylicious Cafe
            </button>
            <p className="footer-desc">A cozy corner in Calape, Bohol where every cup tells a story. Crafted with passion, served with love.</p>
          </div>
          <div>
            <div className="footer-heading">Quick Links</div>
            <ul className="footer-links">
              <li><button onClick={() => go('home')}><i className="bi bi-chevron-right"></i>Home</button></li>
              <li><button onClick={() => go('menu')}><i className="bi bi-chevron-right"></i>Full Menu</button></li>
              <li><button onClick={() => go('cart')}><i className="bi bi-chevron-right"></i>My Order</button></li>
              <li><button onClick={() => go('track')}><i className="bi bi-chevron-right"></i>Track Order</button></li>
            </ul>
          </div>
          <div>
            <div className="footer-heading">Find Us</div>
            <div className="footer-info-item"><i className="bi bi-geo-alt-fill"></i><span>Camias, Calape, Bohol, Philippines, 6328</span></div>
            <div className="footer-info-item"><i className="bi bi-clock-fill"></i><span>Mon-Fri: 7:00 AM - 9:00 PM<br />Sat-Sun: 8:00 AM - 10:00 PM</span></div>
            <div className="footer-info-item"><i className="bi bi-telephone-fill"></i><span>09947598191</span></div>
            <div className="footer-info-item"><i className="bi bi-envelope-fill"></i><span>jelyliciouscafe@gmail.com</span></div>
          </div>
        </div>
        <hr className="footer-hr" />
        <p className="footer-bottom">© 2026 Jekylicious Cafe. All rights reserved.</p>
      </div>
    </footer>
  )
}

function RatingBadge({ rating }: { rating?: { average: number; count: number } }) {
  return <div className="rating-badge"><i className="bi bi-star-fill"></i>{rating ? `${rating.average.toFixed(1)} (${rating.count})` : 'No ratings yet'}</div>
}

function ProductCard({ product, addToCart, rating }: { product: Product; addToCart: (p: Product, q: number) => void; rating?: { average: number; count: number } }) {
  const [qty, setQty] = useState(1)
  const unavailable = product.availabilityStatus === 'out_of_stock'
  return (
    <div className={`product-card ${unavailable ? 'unavailable' : ''}`}>
      <div className="product-card-img">
        <img src={imageSrc(product.image)} alt={product.name} />
        {product.featured && <span className="product-badge">★ Featured</span>}
        {unavailable && <span className="product-badge danger">Not available</span>}
      </div>
      <div className="product-card-body">
        <h5>{product.name}</h5>
        <RatingBadge rating={rating} />
        <p>{product.description}</p>
        <div className="product-price">{peso(product.price)}</div>
      </div>
      <div className="product-card-footer">
        <div className="qty-control">
          <button className="qty-btn" type="button" onClick={() => setQty(Math.max(1, qty - 1))}><i className="bi bi-dash"></i></button>
          <span className="qty-val">{qty}</span>
          <button className="qty-btn" type="button" onClick={() => setQty(qty + 1)}><i className="bi bi-plus"></i></button>
        </div>
        <button className="btn-cafe" disabled={unavailable} onClick={() => addToCart(product, qty)}>{unavailable ? 'Not available' : 'Add to Order'}</button>
      </div>
    </div>
  )
}

function Home({ products, ratingSummary, addToCart, go }: { products: Product[]; ratingSummary: RatingSummary; addToCart: (p: Product, q: number) => void; go: (p: Page) => void }) {
  return (
    <>
      <section className="hero" style={{ background: `linear-gradient(rgba(20,10,5,.62),rgba(44,24,16,.75)),url('${asset('uploads/home.jpg')}') center/cover no-repeat` }}>
        <div className="hero-pattern"></div>
        <div className="container hero-grid">
          <div className="hero-content">
            <div className="hero-badge">Est. 2026 · Handcrafted with Love</div>
            <h1>Where Every Sip Tells a <em>Story</em></h1>
            <p>Premium coffee, artisan pastries, and warm ambiance - all in one place. Order directly from your table, no login required.</p>
            <div className="hero-actions">
              <button className="btn-hero" onClick={() => go('menu')}><i className="bi bi-cup-hot-fill"></i> View Menu</button>
              <a href="#featured" className="btn-hero-out"><i className="bi bi-star-fill"></i> Today's Featured</a>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><div className="num">20+</div><div className="lbl">Menu Items</div></div>
              <div className="hero-stat"><div className="num">6</div><div className="lbl">Categories</div></div>
              <div className="hero-stat"><div className="num">100%</div><div className="lbl">Fresh Daily</div></div>
            </div>
          </div>
            <div className="hero-coffee-icon"><img src={asset('logo1.png')} alt="Jekylicious Cafe" /></div>
        </div>
      </section>
      <div className="features-strip">
        <div className="container feature-grid">
          {[
            ['capetree.png', 'Fresh Daily', 'Baked every morning'],
            ['phone.png', 'Order Online', 'No login required'],
            ['kilat.png', 'Quick Service', 'Ready in minutes'],
            ['cape.png', 'Premium Beans', 'Single-origin roasts'],
          ].map(([img, title, desc]) => <div className="feature-item" key={title}><span className="fi"><img src={asset(img)} alt="" /></span><div><h6>{title}</h6><p>{desc}</p></div></div>)}
        </div>
      </div>
      <section id="featured" className="white">
        <SectionTitle sub="Our Best" title="Featured Today" text="Handpicked by our baristas - the items our customers love most." />
        <div className="container product-grid four">{products.filter((p) => p.featured).slice(0, 8).map((p) => <ProductCard key={p.id} product={p} rating={ratingSummary[p.id]} addToCart={addToCart} />)}</div>
        <div className="center mt-5"><button className="btn-gold" onClick={() => go('menu')}><i className="bi bi-grid-fill"></i> View Full Menu</button></div>
      </section>
      <section className="about-section">
        <div className="container about-grid">
          <div className="about-visual"><img src={asset('pic.jpg')} alt="Our Story" /></div>
          <div>
            <div className="sec-sub">Our Story</div>
            <h2 className="sec-title">More Than Just Coffee</h2>
            <div className="sec-divider left"></div>
            <p>Jekylicious Cafe was born from a dream - to create a space where community gathers, conversations flow, and every cup feels like a warm hug. Est. 2026 in Camias, Calape, Bohol, we've been serving handcrafted beverages and freshly baked goods with the same passion we started with.</p>
            <p>Our beans are carefully sourced from single-origin farms, roasted in small batches to ensure peak freshness. Every pastry is baked fresh each morning by our skilled kitchen team.</p>
            <div className="mini-stat-grid">
              {[[asset('cape.png'), '500+', 'Cups daily'], [asset('star.png'), '4.9', 'Rating'], [asset('capetree.png'), 'Organic', 'Ingredients']].map(([img, n, l]) => <div className="mini-stat" key={l}><img src={img} alt="" /><strong>{n}</strong><span>{l}</span></div>)}
            </div>
          </div>
        </div>
      </section>
      <section className="white">
        <SectionTitle sub="It's Simple" title="How to Order" />
        <div className="container step-grid">
          {[
            ['plato.png', '1. Browse', 'Explore our full menu of coffees, pastries, sandwiches, and more.'],
            ['cart.png', '2. Add Items', 'Add your favorites to the order bag - adjust quantities as needed.'],
            ['papel.png', '3. Checkout', 'Fill in your name and table number. No account needed!'],
            ['check.png', '4. Enjoy!', "We'll prepare your order and bring it right to your table."],
          ].map(([img, title, desc]) => <div className="step-card" key={title}><img src={asset(img)} alt="" /><h5>{title}</h5><p>{desc}</p></div>)}
        </div>
        <div className="center mt-5"><button className="btn-cafe large" onClick={() => go('menu')}><i className="bi bi-cup-hot-fill"></i> Start Ordering Now</button></div>
      </section>
    </>
  )
}

function SectionTitle({ sub, title, text }: { sub: string; title: string; text?: string }) {
  return <div className="section-title"><div className="sec-sub">{sub}</div><h2 className="sec-title">{title}</h2><div className="sec-divider"></div>{text && <p>{text}</p>}</div>
}

function PageHeader({ icon, title, text, crumbs }: { icon?: string; title: string; text: string; crumbs?: string[] }) {
  return <div className="page-header"><div className="container">{crumbs && <div className="breadcrumb">{crumbs.join(' / ')}</div>}<h1>{icon && <i className={`bi ${icon}`}></i>} {title}</h1><p>{text}</p></div></div>
}

function Menu({ products, categories, ratingSummary, addToCart, go, cartCount, subtotal }: { products: Product[]; categories: Category[]; ratingSummary: RatingSummary; addToCart: (p: Product, q: number) => void; go: (p: Page) => void; cartCount: number; subtotal: number }) {
  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const filtered = products.filter((p) => (cat === 'all' || String(p.categoryId) === cat) && `${p.name} ${categories.find((c) => c.id === p.categoryId)?.name}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <>
      <PageHeader icon="bi-menu-button-wide-fill" title="Our Menu" text={`Explore ${products.length} freshly crafted items - order any time, no login required.`} crumbs={['Home', 'Menu']} />
      <section>
        <div className="container">
          <div className="cat-tabs">
            <button className={`cat-tab ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>🍽️ All Items <span>({products.length})</span></button>
            {categories.map((c) => <button key={c.id} className={`cat-tab ${cat === String(c.id) ? 'active' : ''}`} onClick={() => setCat(String(c.id))}>{c.name} <span>({products.filter((p) => p.categoryId === c.id).length})</span></button>)}
          </div>
          <p className="muted mb-4">Showing <strong>{filtered.length}</strong> items</p>
          <div className="search-wrap"><label className="form-label">Search products</label><input className="form-control" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coffee, milk tea, pastries, sandwiches..." /></div>
          <div className="product-grid three">{filtered.map((p) => <ProductCard key={p.id} product={p} rating={ratingSummary[p.id]} addToCart={addToCart} />)}</div>
          {cartCount > 0 && <div className="floating-cart"><button className="btn-gold" onClick={() => go('cart')}><i className="bi bi-bag-fill"></i> View Order Bag ({cartCount} items) - {peso(subtotal)}</button></div>}
        </div>
      </section>
    </>
  )
}

function Cart({ cart, setCart, go, subtotal, tax }: { cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; go: (p: Page) => void; subtotal: number; tax: number }) {
  if (!cart.length) return <><PageHeader title="Your Order Bag" icon="bi-bag-fill" text="Review your items before checking out." crumbs={['Home', 'Order Bag']} /><section><div className="cart-empty"><div className="icon"><i className="bi bi-bag"></i></div><h3>Your bag is empty</h3><p>Looks like you haven't added anything yet. Explore our menu and find something you love!</p><button className="btn-gold mt-3" onClick={() => go('menu')}><i className="bi bi-grid-fill"></i> Browse Menu</button></div></section></>
  return (
    <>
      <PageHeader title="Your Order Bag" icon="bi-bag-fill" text="Review your items before checking out." crumbs={['Home', 'Order Bag']} />
      <section><div className="container cart-grid"><div><div className="cart-top"><h5>{cart.length} Items in your bag</h5><button className="btn-cafe-out" onClick={() => go('menu')}><i className="bi bi-plus"></i> Add More</button></div>{cart.map((item) => <div className="cart-item" key={item.id}><div className="cart-item-thumb"><img src={imageSrc(item.image)} alt="" /></div><div className="cart-item-info"><h6>{item.name}</h6><div>{peso(item.price)} each</div></div><div className="cart-actions"><Qty value={item.quantity} setValue={(q) => setCart((items) => items.map((row) => row.id === item.id ? { ...row, quantity: q } : row).filter((row) => row.quantity > 0))} allowZero /><div className="cart-item-price">{peso(item.price * item.quantity)}</div><button className="cart-remove-btn" onClick={() => setCart((items) => items.filter((row) => row.id !== item.id))}><i className="bi bi-trash3"></i></button></div></div>)}</div><Summary subtotal={subtotal} tax={tax} total={subtotal + tax}><button className="btn-gold full" onClick={() => go('checkout')}><i className="bi bi-credit-card-fill"></i> Proceed to Checkout</button><button className="btn-cafe-out full" onClick={() => go('menu')}>Continue Browsing</button></Summary></div></section>
    </>
  )
}

function Qty({ value, setValue, allowZero = false }: { value: number; setValue: (n: number) => void; allowZero?: boolean }) {
  return <div className="qty-control"><button className="qty-btn" onClick={() => setValue(Math.max(allowZero ? 0 : 1, value - 1))}><i className="bi bi-dash"></i></button><span className="qty-val">{value}</span><button className="qty-btn" onClick={() => setValue(value + 1)}><i className="bi bi-plus"></i></button></div>
}

function Summary({ subtotal, tax, total, deliveryFee, children }: { subtotal: number; tax: number; total: number; deliveryFee?: number; children?: React.ReactNode }) {
  return <div className="cart-summary"><h5>Order Summary</h5><div className="summary-row"><span>Subtotal</span><span>{peso(subtotal)}</span></div>{tax > 0 && <div className="summary-row"><span>Tax</span><span>{peso(tax)}</span></div>}{deliveryFee !== undefined && <div className="summary-row"><span>Delivery Fee</span><span>{peso(deliveryFee)}</span></div>}<div className="summary-row"><strong className="summary-total">Total</strong><strong className="summary-total">{peso(total)}</strong></div><div className="checkout-actions">{children}</div></div>
}

type CheckoutForm = { customerName: string; customerEmail: string; customerPhone: string; orderType: 'pickup' | 'delivery'; scheduleType: 'now' | 'later'; pickupTime: string; deliveryTime: string; deliveryAddress: string; landmark: string; paymentMethod: PaymentMethod; notes: string }
const blankCheckout: CheckoutForm = { customerName: '', customerEmail: '', customerPhone: '', orderType: 'pickup', scheduleType: 'later', pickupTime: nowInput(60), deliveryTime: nowInput(20), deliveryAddress: '', landmark: '', paymentMethod: 'cash_on_pickup', notes: '' }
function feeForAddress(address: string) {
  const text = address.toLowerCase()
  return Object.entries(deliveryFees).find(([area]) => text.includes(area))?.[1] || 0
}
function Checkout({ cart, go, subtotal, tax, placeOrder }: { cart: CartItem[]; go: (p: Page) => void; subtotal: number; tax: number; placeOrder: (f: CheckoutForm) => void }) {
  const [form, setForm] = useState(blankCheckout)
  if (!cart.length) return <section><div className="cart-empty"><h3>Your bag is empty</h3><button className="btn-gold" onClick={() => go('menu')}>Browse Menu</button></div></section>
  const deliveryFee = form.orderType === 'delivery' ? feeForAddress(form.deliveryAddress) : 0
  const isTimeInFuture = (iso: string) => {
    if (!iso) return false
    const ts = new Date(iso).getTime()
    return !isNaN(ts) && ts >= Date.now()
  }
  const scheduleValid = form.scheduleType === 'later' ? (form.orderType === 'pickup' ? isTimeInFuture(form.pickupTime) : isTimeInFuture(form.deliveryTime)) : true
  const valid = Boolean(form.customerName && form.customerPhone && (form.orderType === 'pickup' || (form.deliveryAddress && deliveryFee > 0)) && scheduleValid)
  return (
    <>
      <PageHeader title="Checkout" icon="bi-pencil-square" text="Almost done! Fill in your details and we'll get right on it." crumbs={['Home', 'Order Bag', 'Checkout']} />
      <section className="light">
        <form className="container checkout-grid" onSubmit={(e) => { e.preventDefault(); if (valid) placeOrder(form) }}>
          <div className="checkout-card">
            <h5><i className="bi bi-person-fill"></i> Your Details</h5>
            <div className="form-grid">
              <Field label="Full Name *" value={form.customerName} set={(v) => setForm({ ...form, customerName: v })} placeholder="e.g. Juan dela Cruz" />
              <Field label="Email Address (optional)" value={form.customerEmail} set={(v) => setForm({ ...form, customerEmail: v })} placeholder="you@email.com" />
              <Field label="Contact Number *" value={form.customerPhone} set={(v) => setForm({ ...form, customerPhone: v })} placeholder="+63 900 000 0000" />
              <label className="form-block">Order Type *
                <select className="form-select" value={form.orderType} onChange={(e) => { const orderType = e.target.value as 'pickup' | 'delivery'; setForm({ ...form, orderType, paymentMethod: orderType === 'pickup' ? 'cash_on_pickup' : 'cash_on_delivery', scheduleType: orderType === 'delivery' ? 'later' : form.scheduleType }) }}>
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                </select>
              </label>
              <label className="form-block">When do you need it? *
                <select className="form-select" value={form.scheduleType} onChange={(e) => setForm({ ...form, scheduleType: e.target.value as 'now' | 'later' })} disabled={form.orderType === 'delivery'}>
                  <option value="now">Now (pickup only, automatic 10-minute preparation)</option>
                  <option value="later">Later (pickup: 1 hour, delivery: 20 minutes)</option>
                </select>
                <span className="form-text">Operating hours: Mon-Fri 7:00 AM-9:00 PM, Sat-Sun 8:00 AM-10:00 PM.</span>
              </label>
              {form.orderType === 'pickup' && form.scheduleType === 'later' && <Field label="Pickup Time" type="datetime-local" value={form.pickupTime} set={(v) => setForm({ ...form, pickupTime: v })} />}
              {form.orderType === 'delivery' && <>
                <Field label="Delivery Time" type="datetime-local" value={form.deliveryTime} set={(v) => setForm({ ...form, deliveryTime: v })} />
                <Field label="Delivery Address *" value={form.deliveryAddress} set={(v) => setForm({ ...form, deliveryAddress: v })} placeholder="House No., Street, Barangay" wide hint="Delivery areas: Camias (PHP 10), Ulbujan/Canguha (PHP 15), Sohoton/Desamparados (PHP 20)." />
                <Field label="Landmark (optional)" value={form.landmark} set={(v) => setForm({ ...form, landmark: v })} placeholder="Near school/church/market" wide />
              </>}
              <label className="form-block">Payment Method
                <select className="form-select" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}>
                  {form.orderType === 'pickup' ? <option value="cash_on_pickup">Cash on Pickup</option> : <option value="cash_on_delivery">Cash on Delivery</option>}
                </select>
              </label>
              <label className="form-block wide">Special Instructions (optional)
                <textarea className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Allergies, preferences, or anything else..." />
              </label>
            </div>
          </div>
          <Summary subtotal={subtotal} tax={tax} deliveryFee={deliveryFee} total={subtotal + tax + deliveryFee}>
            {cart.map((item) => <div className="mini-line" key={item.id}><span>{item.name} <em>×{item.quantity}</em></span><strong>{peso(item.price * item.quantity)}</strong></div>)}
            {!scheduleValid && <div className="alert danger">Selected time is in the past. Please choose a future date/time.</div>}
            <button type="submit" disabled={!valid} className="btn-gold full"><i className="bi bi-check2-circle"></i> Place My Order</button>
            <button type="button" className="btn-cafe-out full" onClick={() => go('cart')}><i className="bi bi-arrow-left"></i> Back to Bag</button>
          </Summary>
        </form>
      </section>
    </>
  )
}

function Field({ label, value, set, placeholder, type = 'text', wide, hint, readOnly }: { label: string; value: string; set: (v: string) => void; placeholder?: string; type?: string; wide?: boolean; hint?: string; readOnly?: boolean }) {
  return <label className={`form-block ${wide ? 'wide' : ''}`}>{label}<input type={type} className="form-control" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} readOnly={readOnly} />{hint && <span className="form-text">{hint}</span>}</label>
}

function Confirm({ order, go, setTrackingOrderNumber }: { order?: Order; go: (p: Page) => void; setTrackingOrderNumber: (value: string) => void }) {
  if (!order) return null
  return <>
    <PageHeader title="Order Confirmed!" icon="bi-check-circle-fill" text="Your order has been received. Sit back and relax!" />
    <section className="light">
      <div className="confirm-card">
        <div className="confirm-icon small"><span className="confirm-emoji" role="img" aria-label="confirmed">✅</span><div className="confirm-msg">Order confirmed</div></div>
        <h2>Thank you, {order.customerName}!</h2>
        <p>Your order has been placed successfully. Our team is already on it!</p>
        <div className="order-number-badge">{order.orderNumber}</div>
        <div className="confirm-meta">
          <Info label="Order Type" value={order.orderType} />
          <Info label="Payment" value={paymentLabel(order.paymentMethod)} />
          <Info label="Status" value={statusLabel(order.status)} status={order.status} />
          <Info label="Time" value={new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
          <Info label="Scheduled" value={scheduledLabel(order)} />
        </div>
        <div className="confirm-items">
          <strong>Your Items</strong>
          {order.items.map((item) => <div className="mini-line" key={item.productId}><span>{item.productName} <em>x{item.quantity}</em></span><strong>{peso(item.subtotal)}</strong></div>)}
          <hr />
          <div className="mini-line muted"><span>Delivery Fee</span><span>{peso(order.deliveryFee)}</span></div>
          <div className="mini-line total"><span>Total Amount</span><strong>{peso(order.total)}</strong></div>
        </div>
        {order.notes && <div className="note-box"><strong>Your notes:</strong> {order.notes}</div>}
        <div className="center gap">
          <button className="btn-gold" onClick={() => { setTrackingOrderNumber(order.orderNumber); go('track') }}><i className="bi bi-geo-alt-fill"></i> Track Order</button>
          <button className="btn-cafe" onClick={() => go('menu')}><i className="bi bi-grid-fill"></i> Back to Menu</button>
          <button className="btn-cafe-out" onClick={() => go('home')}><i className="bi bi-house-fill"></i> Home</button>
        </div>
      </div>
    </section>
  </>
}

function Info({ label, value, pill, status }: { label: string; value: string; pill?: boolean; status?: OrderStatus }) {
  return <div><div className="info-label">{label}</div>{pill || status ? <span className={`status-pill ${status ? `s-${status}` : 'status-pending'}`}>{value}</span> : <div className="info-value">{value}</div>}</div>
}
function OrderProgress({ order }: { order: Order }) {
  const steps = order.orderType === 'delivery'
    ? ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered']
    : ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'completed']
  const current = steps.indexOf(order.status)
  return <div className="order-progress">{steps.map((step, index) => <div key={step} className={`progress-step ${index <= current ? 'done' : ''} ${order.status === step ? 'current' : ''}`}><span>{index + 1}</span><small>{statusLabel(step)}</small></div>)}</div>
}

function RatingControls({ item, saved, onRate }: { item: Order['items'][number]; saved: number; onRate: (rating: number) => void }) {
  return <div className="rate-row"><span>{item.productName}</span><div className="star-buttons">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={rating <= saved ? 'active' : ''} onClick={() => onRate(rating)} title={`${rating} stars`}><i className="bi bi-star-fill"></i></button>)}</div></div>
}

function Track({ orders, setOrders, initialOrderNumber, updateOrderInSupabase }: { orders: Order[]; setOrders: React.Dispatch<React.SetStateAction<Order[]>>; initialOrderNumber?: string; updateOrderInSupabase: (orderId: number, patch: Partial<Pick<Order, 'status' | 'ratings'>>) => Promise<void> }) {
  const [query, setQuery] = useState(initialOrderNumber || '')
  const [searched, setSearched] = useState(initialOrderNumber || '')
  useEffect(() => {
    if (!initialOrderNumber) return
    setQuery(initialOrderNumber)
    setSearched(initialOrderNumber)
  }, [initialOrderNumber])
  const order = orders.find((o) => o.orderNumber.toLowerCase() === searched.toLowerCase())
  return <><PageHeader title="Track Your Order" icon="bi-search" text="Enter your order number to view real-time status." /><section className="light"><div className="container narrow"><div className="confirm-card text-left"><form className="track-form" onSubmit={(e) => { e.preventDefault(); setSearched(query) }}><input className="form-control" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Example: BH-1234ABCD" /><button className="btn-cafe"><i className="bi bi-search"></i> Check Status</button></form>{searched && !order && <div className="alert danger">Order not found. Please check the order number.</div>}{order && <div className="track-result"><div className="track-meta"><Info label="Order Number" value={order.orderNumber} /><Info label="Status" value={statusLabel(order.status)} status={order.status} /><Info label="Order Type" value={order.orderType} /><Info label="Payment" value={paymentLabel(order.paymentMethod)} /></div><OrderProgress order={order} /><hr /><strong>Order Items</strong>{order.items.map((item) => <div className="mini-line" key={item.productId}><span>{item.productName} x{item.quantity}</span><span>{peso(item.subtotal)}</span></div>)}<hr /><div className="mini-line total"><strong>Total</strong><strong>{peso(order.total)}</strong></div>{orderDone(order.status) && <div className="rating-panel"><strong>Rate Product</strong>{order.items.map((item) => { const saved = order.ratings?.find((rating) => rating.productId === item.productId)?.rating || 0; return <RatingControls key={item.productId} item={item} saved={saved} onRate={async (rating) => { const nextRatings = [...(order.ratings || []).filter((entry) => entry.productId !== item.productId), { productId: item.productId, rating, ratedAt: new Date().toISOString() }]; const nextOrder: Order = { ...order, ratings: nextRatings }; setOrders((rows) => rows.map((row) => row.id === order.id ? nextOrder : row)); try { await updateOrderInSupabase(order.id, { ratings: nextRatings }) } catch (error) { console.error('Failed to save rating:', error) } }} /> })}</div>}{order.status === 'pending' && <button className="btn-outline-danger mt-3" onClick={async () => { const nextOrder: Order = { ...order, status: 'cancelled' }; const nextOrders = orders.map((o) => o.id === order.id ? nextOrder : o); setOrders(nextOrders); try { await updateOrderInSupabase(order.id, { status: 'cancelled' }) } catch (error) { setOrders(orders); console.error('Failed to cancel order:', error) } }}><i className="bi bi-x-circle"></i> Cancel Order</button>}</div>}</div></div></section></>
}
function AdminLogin({ go, staff, setUser }: { go: (p: Page) => void; staff: Staff[]; setUser: (s: Staff | null) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const found = staff.find((s) => s.status === 'active' && (s.username.toLowerCase() === username.toLowerCase() || s.email.toLowerCase() === username.toLowerCase()) && s.password === password)
    if (!found) return setError('Invalid username or password.')
    setUser(found)
    go(found.isAdmin ? 'admin-dashboard' : 'admin-orders')
  }
  return <div className="login-wrapper"><div className="login-card"><div className="login-logo"><img src={asset('logo1.png')} alt="" /> Jekylicious</div><div className="login-sub">Admin Panel - Staff Login</div>{error && <div className="alert danger">{error}</div>}<form onSubmit={submit}><label className="admin-form-label">Username</label><input className="admin-form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" /><label className="admin-form-label">Password</label><input className="admin-form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /><button className="btn-p full mt-3"><i className="bi bi-box-arrow-in-right"></i> Sign In</button></form><button className="bare admin-back" onClick={() => go('home')}><i className="bi bi-arrow-left"></i> Back to Website</button><p className="demo-hint">Demo: jireh/faith for admin or staff/staff123 for staff</p></div></div>
}

function AdminShell({ user, page, go, logout, menuOpen, setMenuOpen, children }: { user: Staff | null; page: Page; go: (p: Page) => void; logout: () => void; menuOpen: boolean; setMenuOpen: (open: boolean) => void; children: React.ReactNode }) {
  const nav = user?.isAdmin ? [['admin-dashboard', 'Dashboard', 'bi-speedometer2'], ['admin-orders', 'Orders', 'bi-receipt'], ['admin-products', 'Products', 'bi-grid-fill'], ['admin-categories', 'Categories', 'bi-tags-fill'], ['admin-staff', 'Staff', 'bi-people-fill'], ['admin-reports', 'Reports', 'bi-bar-chart-fill']] : [['admin-orders', 'Orders', 'bi-receipt'], ['admin-products', 'Products', 'bi-grid-fill'], ['admin-categories', 'Categories', 'bi-tags-fill']]
  return <div className="admin-layout"><aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`}><div className="sidebar-brand"><span className="brand-name">Jekylicious</span><span className="brand-sub">{user?.isAdmin ? 'Admin Panel' : 'Staff Panel'}</span></div><nav className="sidebar-nav">{nav.map(([p, label, icon]) => <button key={p} className={`sidebar-link ${page === p ? 'active' : ''}`} onClick={() => { setMenuOpen(false); go(p as Page) }}><i className={`bi ${icon}`}></i>{label}</button>)}<div className="sidebar-group-label">Website</div><button className="sidebar-link" onClick={() => { setMenuOpen(false); go('home') }}><i className="bi bi-house"></i>View Website</button></nav><div className="sidebar-footer"><div className="admin-user-info"><div className="admin-avatar">{user?.name[0] || 'A'}</div><div><div className="admin-user-name">{user?.name}</div><div className="admin-user-role">{user?.role}</div></div></div><button className="sidebar-link logout" onClick={() => { setMenuOpen(false); logout() }}><i className="bi bi-box-arrow-right"></i>Logout</button></div></aside>{menuOpen && <button className="admin-overlay" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> }<main className="admin-content"><div className="admin-topbar"><div className="topbar-left"><button className="admin-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu"><i className="bi bi-list"></i></button><div className="topbar-title">{adminTitle(page)}</div></div><div className="topbar-actions"><span>{new Date().toLocaleDateString()}</span></div></div><div className="admin-page">{children}</div></main></div>
}

const adminTitles: Partial<Record<Page, string>> = {
  'admin-dashboard': 'Dashboard',
  'admin-orders': 'Orders',
  'admin-order-view': 'Order Details',
  'admin-products': 'Products',
  'admin-product-form': 'Product Form',
  'admin-categories': 'Categories',
  'admin-staff': 'Staff',
  'admin-staff-form': 'Staff Form',
  'admin-reports': 'Reports',
}
const adminTitle = (page: Page) => adminTitles[page] || 'Admin'

function priority(order: Order) {
  // Completed or cancelled orders should not be treated as overdue
  if (orderDone(order.status) || order.status === 'cancelled') return ['low', 'Low Priority']

  const scheduledRaw = order.orderType === 'delivery' ? order.deliveryTime : order.pickupTime || order.createdAt
  const scheduled = new Date(scheduledRaw).getTime()
  const mins = Math.floor((scheduled - Date.now()) / 60000)
  if (isNaN(scheduled)) return ['low', 'Low Priority']
  if (mins < 0) return ['high', 'Overdue']
  if (mins <= 60) return ['high', 'High Priority']
  if (mins < 300) return ['medium', 'Medium Priority']
  return ['low', 'Low Priority']
}

function scheduledLabel(order: Order) {
  const when = order.orderType === 'delivery' ? order.deliveryTime : order.pickupTime || order.createdAt
  if (!when) return 'Not scheduled'
  try {
    const d = new Date(when)
    return d.toLocaleString()
  } catch {
    return when
  }
}

function Dashboard({ orders, products, staff, ratingSummary, go, setSelectedOrderId }: { orders: Order[]; products: Product[]; staff: Staff[]; ratingSummary: RatingSummary; go: (p: Page) => void; setSelectedOrderId: (id: number) => void }) {
  const today = new Date().toDateString()
  const todayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === today)
  const revenueToday = todayOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  const ratedProducts = Object.values(ratingSummary)
  const avgRating = ratedProducts.length ? (ratedProducts.reduce((sum, row) => sum + row.average, 0) / ratedProducts.length).toFixed(1) : '0.0'
  return <><div className="admin-stat-grid"><Stat icon="bi-receipt" label="Orders Today" value={todayOrders.length} tone="brown" /><Stat icon="bi-currency-dollar" label="Revenue Today" value={peso(revenueToday)} tone="gold" /><Stat icon="bi-grid-fill" label="Active Products" value={products.filter((p) => p.status === 'active').length} tone="green" /><Stat icon="bi-people-fill" label="Active Staff" value={staff.filter((s) => s.status === 'active').length} tone="blue" /><Stat icon="bi-star-fill" label="Avg Product Rating" value={`${avgRating}/5`} tone="gold" /></div><Reports orders={orders} products={products} ratingSummary={ratingSummary} compact /><div className="admin-card"><div className="admin-card-header"><h5><i className="bi bi-clock-history"></i> Recent Orders</h5><button className="btn-outline-p" onClick={() => go('admin-orders')}>View All</button></div><OrderTable orders={orders.slice(0, 10)} go={go} setSelectedOrderId={setSelectedOrderId} /></div></>
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: string | number; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><i className={`bi ${icon}`}></i></div><div><div className="stat-num">{value}</div><div className="stat-label">{label}</div></div></div>
}

function AdminOrders({ orders, setOrders: _setOrders, go, setSelectedOrderId }: { orders: Order[]; setOrders: React.Dispatch<React.SetStateAction<Order[]>>; go: (p: Page) => void; setSelectedOrderId: (id: number) => void }) {
  const [status, setStatus] = useState('all')
  const [customer, setCustomer] = useState('')
  const filtered = orders.filter((o) => (status === 'all' || o.status === status) && o.customerName.toLowerCase().includes(customer.toLowerCase()))
  return <><div className="admin-page-head"><div><h4>Orders</h4><p>{filtered.length} orders found</p></div></div><div className="admin-card filter-card"><input className="admin-form-control" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Search customer..." /><select className="admin-form-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></div><div className="admin-card"><OrderTable orders={filtered} go={go} setSelectedOrderId={setSelectedOrderId} /></div></>
}

function OrderTable({ orders, go, setSelectedOrderId }: { orders: Order[]; go: (p: Page) => void; setSelectedOrderId: (id: number) => void }) {
  if (!orders.length) return <div className="empty-admin">No orders yet.</div>
  return <div className="table-wrap"><table className="admin-table"><thead><tr><th>Order #</th><th>Customer</th><th>Order Type</th><th>Items</th><th>Total</th><th>Priority</th><th>Status</th><th>Date & Time</th><th></th></tr></thead><tbody>{orders.map((o) => { const [pKey, pLabel] = priority(o); return <tr key={o.id}><td><strong>{o.orderNumber}</strong></td><td>{o.customerName}<div className="muted small">{o.customerPhone}</div></td><td>{o.orderType}</td><td>{o.items.length}</td><td><strong>{peso(o.total)}</strong></td><td><span className={`priority-pill priority-${pKey}`}><i className="bi bi-flag-fill"></i>{pLabel}</span></td><td><span className={`status-pill s-${o.status}`}>{statusLabel(o.status)}</span></td><td className="small">{new Date(o.createdAt).toLocaleString()}</td><td><button className="btn-sm-icon" onClick={() => { setSelectedOrderId(o.id); go('admin-order-view') }}><i className="bi bi-eye"></i></button></td></tr> })}</tbody></table></div>
}

function OrderView({ order, go, canManage, updateOrderStatus }: { order?: Order; go: (p: Page) => void; canManage: boolean; updateOrderStatus: (orderId: number, status: OrderStatus) => Promise<void> }) {
  if (!order) return <div className="empty-admin">Order not found.</div>
  const statusOptions: OrderStatus[] = order.orderType === 'delivery'
    ? ['confirmed', 'preparing', 'out_for_delivery', 'delivered']
    : ['confirmed', 'preparing', 'ready_for_pickup', 'completed']
  const [nextStatus, setNextStatus] = useState<OrderStatus>(statusOptions.includes(order.status) ? order.status : statusOptions[0])
  useEffect(() => {
    setNextStatus(statusOptions.includes(order.status) ? order.status : statusOptions[0])
  }, [order.status, order.orderType])
  return <div className="admin-card order-view">
    <div className="admin-card-header"><h5>{order.orderNumber}</h5><button className="btn-outline-p" onClick={() => go('admin-orders')}>Back</button></div>
    <div className="admin-card-body">
      <div className="track-meta">
        <Info label="Customer" value={order.customerName} />
        <Info label="Phone" value={order.customerPhone} />
        <Info label="Order Type" value={order.orderType} />
        <Info label="Status" value={statusLabel(order.status)} pill />
        <Info label="Scheduled" value={scheduledLabel(order)} />
      </div>
      <hr />
      {order.items.map((item) => <div className="mini-line" key={item.productId}><span>{item.productName} x{item.quantity}</span><strong>{peso(item.subtotal)}</strong></div>)}
      <hr />
      <div className="mini-line total"><strong>Total</strong><strong>{peso(order.total)}</strong></div>
      {canManage && <div className="status-actions"><select className="admin-form-select" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrderStatus)}>{statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select><button className="btn-p" onClick={async () => { try { await updateOrderStatus(order.id, nextStatus) } catch (error) { console.error('Failed to update order status:', error) } }}>Update Status</button></div>}
    </div>
  </div>
}

function AdminProducts({ products, categories, ratingSummary, updateProductAvailability, go, setEditProductId }: { products: Product[]; categories: Category[]; ratingSummary: RatingSummary; updateProductAvailability: (productId: number, availabilityStatus: Product['availabilityStatus']) => Promise<void>; go: (p: Page) => void; setEditProductId: (id: number | null) => void }) {
  return <div className="admin-card"><div className="admin-card-header"><h5>Products</h5><button className="btn-p" onClick={() => { setEditProductId(null); go('admin-product-form') }}><i className="bi bi-plus-lg"></i> Add Product</button></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Rating</th><th>Availability</th><th>Status</th><th></th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td><div className="product-cell"><span className="product-thumb"><img src={imageSrc(p.image)} alt="" /></span><strong>{p.name}</strong></div></td><td>{categories.find((c) => c.id === p.categoryId)?.name}</td><td>{peso(p.price)}</td><td>{ratingSummary[p.id] ? `${ratingSummary[p.id].average.toFixed(1)} (${ratingSummary[p.id].count})` : 'No ratings'}</td><td><span className={`status-pill s-${p.availabilityStatus === 'available' ? 'active' : 'cancelled'}`}>{p.availabilityStatus.replaceAll('_', ' ')}</span></td><td><span className={`status-pill s-${p.status}`}>{p.status}</span></td><td><button className="btn-sm-icon" onClick={() => { setEditProductId(p.id); go('admin-product-form') }}><i className="bi bi-pencil"></i></button><button className="btn-sm-icon danger" onClick={async () => { try { await updateProductAvailability(p.id, p.availabilityStatus === 'available' ? 'out_of_stock' : 'available') } catch (error) { console.error('Failed to update product availability:', error) } }}><i className="bi bi-slash-circle"></i></button></td></tr>)}</tbody></table></div></div>
}

function ProductForm({ product, categories, setProducts, go }: { product?: Product; categories: Category[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; go: (p: Page) => void }) {
  const [form, setForm] = useState<Product>(product || { id: Date.now(), categoryId: 1, name: '', description: '', price: 0, featured: false, status: 'active', availabilityStatus: 'available', image: 'espresso.jpg' })
  return <form className="admin-card admin-card-body" onSubmit={(e) => { e.preventDefault(); setProducts((rows) => product ? rows.map((p) => p.id === product.id ? form : p) : [...rows, form]); go('admin-products') }}><h5>{product ? 'Edit Product' : 'Add Product'}</h5><div className="form-grid"><Field label="Name" value={form.name} set={(v) => setForm({ ...form, name: v })} /><label className="form-block">Category<select className="form-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="form-block">Availability<select className="form-select" value={form.availabilityStatus} onChange={(e) => setForm({ ...form, availabilityStatus: e.target.value as Product['availabilityStatus'] })}><option value="available">Available</option><option value="out_of_stock">Not available right now</option></select></label><Field label="Price" type="number" value={String(form.price)} set={(v) => setForm({ ...form, price: Number(v) })} /><Field label="Image filename" value={form.image} set={(v) => setForm({ ...form, image: v })} /><label className="form-block wide">Description<textarea className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label className="check-row"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label></div><button className="btn-p">Save Product</button></form>
}

function Categories({ categories, setCategories, products }: { categories: Category[]; setCategories: React.Dispatch<React.SetStateAction<Category[]>>; products: Product[] }) {
  const [name, setName] = useState('')
  return <div className="admin-card"><div className="admin-card-header"><h5>Categories</h5></div><div className="admin-card-body"><form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (name) setCategories((rows) => [...rows, { id: Date.now(), name, icon: 'bi-cup', sortOrder: rows.length + 1 }]); setName('') }}><input className="admin-form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" /><button className="btn-p">Add</button></form></div><table className="admin-table"><tbody>{categories.map((c) => <tr key={c.id}><td>{c.name}</td><td>{products.filter((p) => p.categoryId === c.id).length} products</td><td><button className="btn-sm-icon danger" onClick={() => setCategories((rows) => rows.filter((row) => row.id !== c.id))}><i className="bi bi-trash"></i></button></td></tr>)}</tbody></table></div>
}

function StaffPage({ staff, setStaff, go, setEditStaffId }: { staff: Staff[]; setStaff: React.Dispatch<React.SetStateAction<Staff[]>>; go: (p: Page) => void; setEditStaffId: (id: number | null) => void }) {
  return <div className="admin-card"><div className="admin-card-header"><h5>Staff</h5><button className="btn-p" onClick={() => { setEditStaffId(null); go('admin-staff-form') }}>Add Staff</button></div><table className="admin-table"><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>{staff.map((s) => <tr key={s.id}><td>{s.name}</td><td>{s.role}</td><td>{s.email}</td><td><span className={`status-pill s-${s.status}`}>{s.status}</span></td><td><button className="btn-sm-icon" onClick={() => { setEditStaffId(s.id); go('admin-staff-form') }}><i className="bi bi-pencil"></i></button><button className="btn-sm-icon danger" onClick={() => setStaff((rows) => rows.map((row) => row.id === s.id ? { ...row, status: row.status === 'active' ? 'inactive' : 'active' } : row))}><i className="bi bi-person-dash"></i></button></td></tr>)}</tbody></table></div>
}

function StaffForm({ member, setStaff, go }: { member?: Staff; setStaff: React.Dispatch<React.SetStateAction<Staff[]>>; go: (p: Page) => void }) {
  const [form, setForm] = useState<Staff>(member || { id: Date.now(), name: '', role: 'Staff', email: '', username: '', password: '', status: 'active', isAdmin: false })
  return <form className="admin-card admin-card-body" onSubmit={(e) => { e.preventDefault(); setStaff((rows) => member ? rows.map((s) => s.id === member.id ? form : s) : [...rows, form]); go('admin-staff') }}><h5>{member ? 'Edit Staff' : 'Add Staff'}</h5><div className="form-grid"><Field label="Name" value={form.name} set={(v) => setForm({ ...form, name: v })} /><Field label="Email" value={form.email} set={(v) => setForm({ ...form, email: v })} /><Field label="Username" value={form.username} set={(v) => setForm({ ...form, username: v })} /><Field label="Password" value={form.password} set={(v) => setForm({ ...form, password: v })} /><label className="form-block">Role<select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, isAdmin: e.target.value === 'Admin' })}><option>Admin</option><option>Staff</option><option>Cashier</option><option>Barista</option></select></label></div><button className="btn-p">Save Staff</button></form>
}

function Reports({ orders, products, ratingSummary, compact }: { orders: Order[]; products: Product[]; ratingSummary: RatingSummary; compact?: boolean }) {
  const valid = orders.filter((o) => o.status !== 'cancelled')
  const total = valid.reduce((s, o) => s + o.total, 0)
  const sold = new Map<string, { qty: number; sales: number }>()
  valid.forEach((o) => o.items.forEach((i) => sold.set(i.productName, { qty: (sold.get(i.productName)?.qty || 0) + i.quantity, sales: (sold.get(i.productName)?.sales || 0) + i.subtotal })))
  const best = [...sold.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5)
  const rated = products.map((product) => ({ product, rating: ratingSummary[product.id] })).filter((row) => row.rating).sort((a, b) => b.rating.average - a.rating.average).slice(0, 8)
  return <><div className="admin-stat-grid reports"><Stat icon="bi-calendar-day" label="Daily Sales" value={peso(total)} tone="brown" /><Stat icon="bi-calendar-month" label="Monthly Sales" value={peso(total)} tone="gold" /><Stat icon="bi-receipt" label="Total Orders" value={orders.length} tone="blue" /><Stat icon="bi-cash-stack" label="Total Revenue" value={peso(total)} tone="green" /></div>{!compact && <><div className="admin-card"><div className="admin-card-header"><h5>Best-Selling Products</h5></div><table className="admin-table"><thead><tr><th>Product</th><th>Units Sold</th><th>Gross Sales</th></tr></thead><tbody>{best.map(([name, row]) => <tr key={name}><td><strong>{name}</strong></td><td>{row.qty}</td><td>{peso(row.sales)}</td></tr>)}</tbody></table></div><div className="admin-card"><div className="admin-card-header"><h5>Product Ratings Summary</h5></div><table className="admin-table"><thead><tr><th>Product</th><th>Average Rating</th><th>Total Ratings</th></tr></thead><tbody>{rated.length ? rated.map(({ product, rating }) => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{rating.average.toFixed(1)} / 5</td><td>{rating.count}</td></tr>) : <tr><td colSpan={3}>No product ratings yet.</td></tr>}</tbody></table></div></>}</>
}
export default App






