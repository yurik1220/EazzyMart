(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'groceryItems';
    const CART_KEY = 'cart';
    const ORDERS_KEY = 'orders';

    // State
    let products = [];
    let cart = JSON.parse(localStorage.getItem(CART_KEY)) || {};

    // Elements (some may not exist depending on HTML version; we handle that)
    const productList = document.getElementById('product-list');
    const cartSection = document.getElementById('cart-section');
    const cartItems = document.getElementById('cart-items');
    const totalPriceEl = document.getElementById('total-price');
    const cartCountEl = document.getElementById('cart-count');
    const checkoutSection = document.getElementById('checkout-section');
    const browseSection = document.getElementById('browse');
    const shopNowBtn = document.querySelector('.shop-now-btn');
    const checkoutForm = document.getElementById('checkout-form');
    const orderTypeSelect = document.getElementById('orderType');
    const addressGroup = document.getElementById('address-group');
    const addressInput = document.getElementById('address');

        // ===== CUSTOMER LOGIN / REGISTER =====
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // onMounted
    document.addEventListener("DOMContentLoaded", () => {
      console.log('DOM Loaded successfully');
      const userData = localStorage.getItem('currentUser');

      if (userData) {
        const user = JSON.parse(userData);
        console.log("User is logged in:", user);
      } else {
        console.log("No user logged in");
      }
    });

    async function loginUser(username, password) {
      try {
        const res = await fetch(window.getApiUrl('api/customer/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role: 'customer' })
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');

        // Save user to localStorage
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        showNotification(`Welcome ${data.user.username}!`, 'success');

        // Redirect or toggle visibility to browse section
        openBrowse();
      } catch (err) {
        console.error('Login error:', err);
        showNotification(err.message || 'Invalid credentials', 'error');
      }
    }

    async function registerUser(username, password) {
      try {
        const res = await fetch(window.getApiUrl('api/customer/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role: 'customer' })
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Registration failed');

        showNotification('Account created successfully! You can now log in.', 'success');
      } catch (err) {
        console.error('Register error:', err);
        showNotification(err.message || 'Registration failed', 'error');
      }
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username')?.value?.trim();
        const password = document.getElementById('login-password')?.value?.trim();
        if (!username || !password) return showNotification('Enter your username and password', 'warning');
        await loginUser(username, password);
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username')?.value?.trim();
        const password = document.getElementById('register-password')?.value?.trim();
        if (!username || !password) return showNotification('Please complete all fields', 'warning');
        await registerUser(username, password);
      });
    }

const logoutBtn = document.getElementById('logout-btn');

  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Confirm Logout',
      text: 'Do you really want to log out?',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, Logout'
    });

    if (!result.isConfirmed) return;
    await Swal.fire({
      icon: 'success',
      title: 'Logged Out',
      text: 'Redirecting to login page...',
      showConfirmButton: false,
      timer: 1200
    });

    // Redirect back to your secure login page
    localStorage.removeItem('currentUser');
    window.location.replace('login.html');
  });

    // Broadcast channel for sending orders to cashier
    const orderChannel = new BroadcastChannel('orders');

    // Utility: find first selector that exists
    function findEl(selectors) {
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el) return el;
      }
      return null;
    }

    // Utility: try multiple field IDs to get a value (safe)
    function getFieldValue(possibleIds, fallback = '') {
      for (const id of possibleIds) {
        const el = document.getElementById(id);
        if (el && el.value != null) return el.value.trim();
      }
      return fallback;
    }

    // ====== SECTION TOGGLE FIX ======
function toggleVisibility(showSection) {
  const promoBanner = document.querySelector('.promo-banner');
  const categoriesSection = document.querySelector('.categories');
  const browseSection = document.getElementById('browse');
  const cartSection = document.getElementById('cart-section');
  const checkoutSection = document.getElementById('checkout-section');

  const allSections = [promoBanner, categoriesSection, browseSection, cartSection, checkoutSection];

  // Hide everything first
  allSections.forEach(sec => {
    if (sec) {
      sec.classList.add('hidden');
      sec.style.display = 'none';
    }
  });

  // Show the target section
  if (showSection) {
    showSection.classList.remove('hidden');
    showSection.style.display = 'block';
    showSection.classList.add('fade-in');
  }
}

// ====== BUTTON TRIGGERS ======
function openCart() {
  const cartSection = document.getElementById('cart-section');
  toggleVisibility(cartSection);
}

function openCheckout() {
  const checkoutSection = document.getElementById('checkout-section');
  toggleVisibility(checkoutSection);
}

function openBrowse() {
  const browseSection = document.getElementById('browse');
  const promoBanner = document.querySelector('.promo-banner');
  const categoriesSection = document.querySelector('.categories');

  // Show homepage (promo + categories + browse)
  [promoBanner, categoriesSection, browseSection].forEach(sec => {
    if (sec) {
      sec.classList.remove('hidden');
      sec.style.display = 'block';
      sec.classList.add('fade-in');
    }
  });
}


    // Load products from localStorage (dedupe by id)
    function loadProductsFromStorage() {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      const unique = [];
      const seen = new Set();
      for (const p of stored) {
        if (!p || (p.id == null)) continue;
        const key = String(p.id);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(p);
        }
      }
      products = unique;
      // persist the deduped list
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      return products;
    }

    // If no items in storage, optionally load products.json (one-time)
    async function ensureProductsLoaded() {
      loadProductsFromStorage();
      if (products.length === 0 && productList) {
        try {
          const res = await fetch('products.json');
          if (res.ok) {
            const data = await res.json();
            // dedupe incoming
            const seen = new Set(products.map(p => String(p.id)));
            for (const p of data) {
              if (p && p.id != null && !seen.has(String(p.id))) {
                products.push(p);
                seen.add(String(p.id));
              }
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
          }
        } catch (err) {
          console.debug('No products.json or fetch failed (this is okay if you use admin to add products).', err);
        }
      }
      renderProducts(products);
    }

    // added api call
     async function getItemsfromDB(){
      try {
        const response = await fetch(window.getApiUrl('api/items'));
        if (!response.ok) return [];
        const data = await response.json();
        if (!Array.isArray(data)) return [];
        return data;
      } catch (error) {
        console.error('Error fetching data:', error);
        // fallback to empty so renderProducts can use local products
        return [];
      }
    }

    // Render list — merge API data with local `products` so local stock changes persist
    async function renderProducts(list = products) {
      // try API (may be empty)
      const apiData = await getItemsfromDB();

      if (!productList) return;
      productList.innerHTML = '';
      const arr = Array.isArray(list) ? list : [];

      // If API returned something, merge it with local 'products' so local stock overrides API stock.
      // We keep other API fields but prefer local stock and any local product properties.
      let source;
      if (Array.isArray(apiData) && apiData.length > 0) {
        // make a map of local products by id for quick lookup
        const localMap = (Array.isArray(products) ? products : []).reduce((m, p) => {
          if (p && p.id != null) m[String(p.id)] = p;
          return m;
        }, {});
        source = apiData.map(d => {
          const idKey = d && d.id != null ? String(d.id) : null;
          if (idKey && localMap[idKey]) {
            // merge: prefer local stock and keep local name/price if present
            const local = localMap[idKey];
            return {
              ...d,
              // ensure numeric stock
              stock: Number(local.stock != null ? local.stock : d.stock || 0),
              // prefer local name/price if available (keeps snapshots in sync)
              name: (local.name || local.names || d.name || d.names),
              price: Number(local.price != null ? local.price : d.price || 0)
            };
          } else {
            // ensure numeric stock on API-only item
            return { ...d, stock: Number(d.stock || 0), price: Number(d.price || 0) };
          }
        });

        // Also keep any local-only products (not present on API) appended so admin-added local products are not lost
        const apiIds = new Set(apiData.map(x => String(x.id)));
        const localOnly = (Array.isArray(products) ? products : []).filter(p => p && p.id != null && !apiIds.has(String(p.id)));
        if (localOnly.length) source = source.concat(localOnly);
        // update global products with merged source so future operations use this merged state
        products = source.slice();
        // persist merged
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      } else {
        // No API data — use provided list (already deduped earlier)
        if (arr.length === 0) {
          productList.innerHTML = '<p>No products available.</p>';
          return;
        }
        source = arr;
      }

      // Render the source array
      source.forEach(product => {
        const name = (product.name || product.names || 'Unnamed Product').toString();
        const price = Number(product.price || 0);
        const stock = Number(product.stock || 0);
        const category = product.category || 'Uncategorized';
        const image = product.images || 'https://via.placeholder.com/200';

        const card = document.createElement('div');
        card.className = 'product-list';
        card.innerHTML = `
          <div class="product-card g-col-md-3 row g-3">
            <img src="${image}" alt="${escapeHtml(name)}">
            <h3>${escapeHtml(name)}</h3>
            <p class="price">₱${price?.toFixed(2)}</p>
            <p class="stock">Stock: ${stock}</p>
            <p class="category-tag">Category: ${escapeHtml(category)}</p>
            <button class="add-btn" data-id="${product.id}" ${stock <= 0 ? 'disabled' : ''}>
              ${stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        `;
        productList.appendChild(card);
      });

      // attach handlers to add buttons (safe)
      productList.querySelectorAll('.add-btn').forEach(btn => {
        btn.removeEventListener('click', onAddBtnClick); // safe remove
        btn.addEventListener('click', onAddBtnClick);
      });

      // persist the most recent products into storage (deduped)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    }

    // helpful small escaping for text
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Add button handler
    function onAddBtnClick(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      addToCart(id);
    }

    // find product by id (loose compare)
    function findProduct(id) {
      return products.find(p => String(p.id) === String(id));
    }

    // Add to cart
    function addToCart(id) {
      const product = findProduct(id);
      if (!product) {
        showNotification('Product not found', 'warning');
        console.warn('addToCart: product not found for id', id);
        return;
      }
      if (Number(product.stock) <= 0) {
        showNotification('Out of stock', 'warning');
        return;
      }

      product.stock = Number(product.stock) - 1;
      if (!cart[id]) {
        // store minimal product snapshot (name, price, id)
        cart[id] = {
          id: product.id,
          name: product.name || product.names || 'Unnamed Product',
          price: Number(product.price) || 0,
          qty: 1
        };
      } else {
        cart[id].qty = Number(cart[id].qty || 0) + 1;     
      }

      persistState();
      renderProducts(products);
      renderCart();
      showNotification(`Added ${product.name || product.names} to cart`, 'success');
    }

    // Remove from cart completely (restores stock)
    function removeFromCart(id) {
      if (!cart[id]) return;
      const quantity = Number(cart[id].qty || 0);
      const product = findProduct(id);
      if (product) {
        product.stock = Number(product.stock || 0) + quantity;
      }
      delete cart[id];
      persistState();
      renderProducts(products);
      renderCart();
      showNotification('Removed item from cart', 'info');
    }

    // Decrease or increase qty (optional helper)
    async function changeQty(id, delta) {
      if (!cart[id]) return;
      const product = findProduct(id);
      if (!product && delta > 0) return;

      if (delta > 0) {
        if (product.stock <= 0) { showNotification('No more stock', 'warning'); return; }
        cart[id].qty += delta;
        product.stock -= delta;
      } else {
        cart[id].qty += delta;
        product.stock -= delta; // delta negative -> restore stock
        if (cart[id].qty <= 0) delete cart[id];
      }
      persistState();
      renderProducts(products);
      renderCart();
    }

    // Render cart UI
    function renderCart() {
      if (!cartItems) return;
      cartItems.innerHTML = '';
      const values = Object.values(cart);
      if (values.length === 0) {
        cartItems.innerHTML = '<p>No items in the cart.</p>';
        totalPriceEl && (totalPriceEl.textContent = '0.00');
        cartCountEl && (cartCountEl.textContent = '0');
        return;
      }
      let total = 0;
      let count = 0;
      values.forEach(it => {
        total += (Number(it.price) || 0) * Number(it.qty || 0);
        count += Number(it.qty || 0);

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
          <div class="cart-details">
            <strong>${escapeHtml(it.name)}</strong>
            <div>₱${Number(it.price).toFixed(2)} x ${it.qty}</div>
          </div>
          <div class="cart-actions">
            <button class="cart-dec" data-id="${it.id}">➖</button>
            <button class="cart-inc" data-id="${it.id}">➕</button>
            <button class="cart-rem" data-id="${it.id}">Remove</button>
          </div>
        `;
        cartItems.appendChild(div);
      });

      // hook cart action buttons
      cartItems.querySelectorAll('.cart-inc').forEach(b => b.addEventListener('click', e => {
        changeQty(e.currentTarget.dataset.id, 1);
      }));
      cartItems.querySelectorAll('.cart-dec').forEach(b => b.addEventListener('click', e => {
        changeQty(e.currentTarget.dataset.id, -1);
      }));
      cartItems.querySelectorAll('.cart-rem').forEach(b => b.addEventListener('click', e => {
        removeFromCart(e.currentTarget.dataset.id);
      }));

      totalPriceEl && (totalPriceEl.textContent = total.toFixed(2));
      cartCountEl && (cartCountEl.textContent = count);
    }

    // Save cart + products to storage
    function persistState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    // Save only cart
    function saveCart() {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }

    // Notification helper (SweetAlert2 if available, otherwise small toast)
    function showNotification(msg, icon = 'info') {
      if (window.Swal && typeof Swal.fire === 'function') {
        // map icons for Swal
        const map = { info: 'info', success: 'success', warning: 'warning', error: 'error' };
        Swal.fire({
          icon: map[icon] || 'info',
          title: msg,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      } else {
        // fallback minimal toast (keeps existing behavior)
        const note = document.createElement('div');
        note.className = 'notification';
        note.textContent = msg;
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 3000);
      }
    }

    // Checkout form handler (if present)
    if (checkoutForm) {
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (Object.keys(cart).length === 0) {
        if (window.Swal && typeof Swal.fire === 'function') {
            await Swal.fire({
                icon: 'warning',
                title: 'Empty cart',
                text: 'Please add items to your cart before placing an order.',
                confirmButtonColor: '#3085d6'
            });
        } else {
            showNotification('Your cart is empty', 'warning');
        }
        return;
    }

    // Collect form info safely
    const customer = getFieldValue(['customerName', 'fullname', 'name'], 'Guest');

// --- FIXED PAYMENT METHOD ---
let payment = 'Cash On Delivery'; // default fallback (match display capitalization)

// First, check for any selected radio buttons
const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
if (paymentRadios.length > 0) {
  const checked = Array.from(paymentRadios).find(r => r.checked);
  if (checked) {
    const val = checked.value.trim().toLowerCase();
    if (val.includes('gcash')) payment = 'GCash';
    else payment = 'Cash On Delivery';
  }
} else {
  // Fallback: look for dropdowns or inputs
  const paymentInput = document.querySelector('#payment, #paymentMethod, #paymentMethodSelect');
  if (paymentInput && paymentInput.value) {
    const val = paymentInput.value.trim().toLowerCase();
    if (val.includes('gcash')) payment = 'GCash';
    else payment = 'Cash On Delivery';
  }
}

// Confirm what’s detected (for testing, optional)
console.log('✅ Detected Payment Method:', payment);

const type = (orderTypeSelect && orderTypeSelect.value)
  ? orderTypeSelect.value
  : getFieldValue(['orderType', 'order_type'], 'Delivery');

const address = (type === 'Pickup')
  ? '-'
  : (addressInput && addressInput.value
      ? addressInput.value.trim()
      : getFieldValue(['address', 'deliveryAddress', 'addr'], '-'));

// Compute totals
const cartItemsArr = Object.values(cart);
let total = cartItemsArr.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
let items = cartItemsArr.reduce((c, i) => c + (Number(i.qty) || 0), 0);

// Create new order object
const newOrder = {
  id: Date.now(),
  customer,
  items: Object.values(cart), // actual item list, not just count
  total,
  payment,
  type,
  address,
  status: 'Pending'
};

// Save order locally
try {
  const existingOrders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  existingOrders.push(newOrder);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(existingOrders));
} catch (err) {
  console.error('❌ Failed to persist order locally', err);
}

// Send order to backend
try {
  const response = await fetch(window.getApiUrl('api/sales'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newOrder)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Failed to record sale');
  console.log('✅ Sale recorded in backend:', result);
} catch (err) {
  console.error('❌ Failed to send order to backend:', err);
  showNotification('Could not send order to server. Saved locally instead.', 'warning');
}
// Broadcast to cashier (real-time update)
try {
  orderChannel.postMessage({ action: 'new-order', order: newOrder });
  console.log('📢 Order sent to cashier:', newOrder);
} catch (err) {
  console.warn('⚠️ Failed to post order via BroadcastChannel', err);
}

// Confirmation alert
if (window.Swal && typeof Swal.fire === 'function') {
  await Swal.fire({
    icon: 'success',
    title: 'Order Placed!',
    html: `
      <p>Thank you, <strong>${escapeHtml(customer)}</strong>!</p>
      <p><b>${escapeHtml(type)}</b> — ₱${Number(total).toFixed(2)}</p>
      <p><b>Payment Method:</b> ${escapeHtml(payment)}</p>
      ${type === 'Delivery' ? `<p><i>${escapeHtml(address)}</i></p>` : ''}
    `,
    confirmButtonText: 'OK',
    confirmButtonColor: '#28a745'
  });
} else {
  showNotification('Order placed. Thank you!', 'success');
}

// Clear cart and return to browse
cart = {};
persistState();
renderCart();
openBrowse();
});

       // orderTypeSelect change handling
  if (orderTypeSelect) {
    orderTypeSelect.addEventListener('change', () => {
      if (!addressGroup || !addressInput) return;
      if (orderTypeSelect.value === 'Pickup') {
        addressGroup.classList.add('d-none');
        addressInput.removeAttribute('required');
        addressInput.value = '';
      } else {
        addressGroup.classList.remove('d-none');
        addressInput.setAttribute('required', 'required');
      }
    });
    }
  }

    // BroadcastChannel: synchronize updates from admin
    const updateChannel = new BroadcastChannel('product-updates');
    updateChannel.onmessage = (event) => {
      const { action, product, id, allProducts } = event.data;

      // If admin sends whole list, replace (dedupe)
      if (Array.isArray(allProducts)) {
        const seen = new Set();
        const unique = [];
        for (const p of allProducts) {
          if (!p || p.id == null) continue;
          const k = String(p.id);
          if (!seen.has(k)) {
            seen.add(k);
            unique.push(p);
          }
        }
        products = unique;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
        renderProducts(products);
        renderCart();
        console.debug('Replaced products from admin (allProducts).');
        return;
      }

      // Handle incremental actions
      if (action === 'add' && product) {
        if (!products.some(p => String(p.id) === String(product.id))) {
          products.push(product);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
          renderProducts(products);
          showNotification(`New product: ${product.name || product.names || 'Unnamed'}`, 'info');
        } else {
          console.debug('add ignored (duplicate id)');
        }
      } else if (action === 'edit' && product) {
        const idx = products.findIndex(p => String(p.id) === String(product.id));
        if (idx !== -1) {
          products[idx] = product;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
          renderProducts(products);
          showNotification(`Updated: ${product.name || product.names}`, 'info');
        }
      } else if (action === 'delete') {
        const before = products.length;
        products = products.filter(p => String(p.id) !== String(id));
        if (products.length < before) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
          renderProducts(products);
          showNotification('Product removed', 'info');
        }
      }
    };

    // Category filters (support links)
    document.querySelectorAll('.category-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const label = btn.textContent.replace(/[^a-zA-Z ]/g, '').trim();
        const filtered = products.filter(p => p.category && String(p.category).toLowerCase().includes(label.toLowerCase()));
        if (filtered.length === 0) {
          if (productList) productList.innerHTML = `<p>No products found in ${label}.</p>`;
        } else {
          renderProducts(filtered);
        }
        openBrowse();
      });
    });

    // Shop now button - show all
    if (shopNowBtn) {
      shopNowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderProducts(products);
        openBrowse();
      });
    }

    // Cart / Checkout toggle - support multiple possible IDs to be robust
    const cartToggle = findEl(['#cart-link', '#open-cart', '#cart-button', '[data-action="open-cart"]']);
    const checkoutToggle = findEl(['#checkout-link', '#open-checkout', '#checkout-button', '[data-action="open-checkout"]']);
    // Also nav alt ids
    const fallbackCartLink = document.getElementById('cart-link');
    const fallbackCheckoutLink = document.getElementById('checkout-link');
    if (cartToggle) cartToggle.addEventListener('click', (e) => { e.preventDefault(); openCart(); });
    if (!cartToggle && fallbackCartLink) fallbackCartLink.addEventListener('click', (e) => { e.preventDefault(); openCart(); });

    if (checkoutToggle) checkoutToggle.addEventListener('click', (e) => { e.preventDefault(); openCheckout(); });
    if (!checkoutToggle && fallbackCheckoutLink) fallbackCheckoutLink.addEventListener('click', (e) => { e.preventDefault(); openCheckout(); });

    // Also bind checkout button inside cart section if present
    const checkoutBtnInCart = document.getElementById('checkout-button');
    if (checkoutBtnInCart) checkoutBtnInCart.addEventListener('click', (e) => { e.preventDefault(); openCheckout(); });

    // === Back Navigation Buttons ===
    const backToShopBtn = document.getElementById('back-to-shop');
    const backToCartBtn = document.getElementById('back-to-cart');

    if (backToShopBtn) {
      backToShopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openBrowse();
      });
    }

    if (backToCartBtn) {
      backToCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openCart();
      });
    }
    
    // Initialize
    ensureProductsLoaded().then(() => {
      // Initialize cart UI from storage
      renderCart();

      // Load persisted orders silently (cashier will read from same localStorage if needed)
      try {
        const persisted = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
        // nothing to do on customer side, but keep for consistency
        console.debug('Loaded persisted orders count:', Array.isArray(persisted) ? persisted.length : 0);
      } catch (err) {
        console.debug('No persisted orders found or parse error', err);
      }

      console.debug('Customer script initialized', { productsCount: products.length, cartCount: Object.keys(cart).length });
    }).catch(err => {
      console.error('Initialization error', err);
    });
  });
})();
