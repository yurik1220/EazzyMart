(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'groceryItems';
    const CART_KEY = 'cart';
    const ORDERS_KEY = 'orders';
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // State
    let products = [];
    let cart = JSON.parse(localStorage.getItem(CART_KEY)) || {};
    
    // Helper to sync cart from localStorage (ensures we always have latest state)
    function syncCartFromStorage() {
      try {
        const storedCart = JSON.parse(localStorage.getItem(CART_KEY)) || {};
        cart = storedCart;
        return cart;
      } catch (e) {
        console.error('Error syncing cart from storage:', e);
        return cart;
      }
    }

    // Elements (some may not exist depending on HTML version; we handle that)
    const productList = document.getElementById('product-list');
    const cartSection = document.getElementById('cart-section'); // May not exist on Index.html
    const cartItems = document.getElementById('cart-items'); // May not exist on Index.html
    const totalPriceEl = document.getElementById('total-price'); // May not exist on Index.html
    const cartCountEl = document.getElementById('cart-count');
    const checkoutSection = document.getElementById('checkout-section'); // May not exist on Cart.html
    const browseSection = document.getElementById('browse'); // May not exist on Cart.html
    const shopNowBtn = document.querySelector('.shop-now-btn');
    const checkoutForm = document.getElementById('checkout-form'); // May not exist on Cart.html
    const orderTypeSelect = document.getElementById('orderType'); // May not exist on Cart.html
    const addressGroup = document.getElementById('address-group'); // May not exist on Cart.html
    const addressInput = document.getElementById('address'); // May not exist on Cart.html
    const contactInput = document.getElementById('contactnumber'); // May not exist on Cart.html

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
  const checkoutSection = document.getElementById('checkout-section');

  const allSections = [promoBanner, categoriesSection, browseSection, checkoutSection];

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
  // Navigate to cart page instead of toggling visibility
  window.location.href = 'Cart.html';
}

function openCheckout() {
  const checkoutSection = document.getElementById('checkout-section');
  if (checkoutSection) {
    // If on Index.html, toggle visibility
    toggleVisibility(checkoutSection);
  } else {
    // If checkout section doesn't exist (e.g., on Cart.html), navigate to checkout page
    window.location.href = 'Checkout.html';
  }
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
    // If a filtered list is provided, use it directly without fetching from API
    async function renderProducts(list = null, skipApiFetch = false) {
      if (!productList) return;
      productList.innerHTML = '';
      
      let source;
      
      // If skipApiFetch is true or list is provided (filtered), use the list directly
      if (skipApiFetch && list && Array.isArray(list) && list.length > 0) {
        console.log('Using provided filtered list directly, skipping API fetch');
        // Update products array with latest stock from API if available (non-blocking)
        getItemsfromDB().then(apiData => {
          if (Array.isArray(apiData) && apiData.length > 0) {
            // Update stock values in products array from API
            apiData.forEach(apiProduct => {
              const localProduct = products.find(p => String(p.id) === String(apiProduct.id));
              if (localProduct) {
                localProduct.stock = Number(apiProduct.stock || 0);
              }
            });
            // Update the filtered list as well
            list.forEach(filteredProduct => {
              const apiProduct = apiData.find(p => String(p.id) === String(filteredProduct.id));
              if (apiProduct) {
                filteredProduct.stock = Number(apiProduct.stock || 0);
              }
            });
          }
        }).catch(err => {
          console.debug('Non-blocking API fetch failed (this is okay):', err);
        });
        source = list;
      } else {
        // Otherwise, fetch from API and merge (normal flow)
        const apiData = await getItemsfromDB();
        const arr = Array.isArray(list) && list.length > 0 ? list : products;
        
        // If API returned something, merge it with local 'products' so local stock overrides API stock.
        // We keep other API fields but prefer local stock and any local product properties.
        if (Array.isArray(apiData) && apiData.length > 0) {
          // make a map of local products by id for quick lookup
          const localMap = (Array.isArray(products) ? products : []).reduce((m, p) => {
            if (p && p.id != null) m[String(p.id)] = p;
            return m;
          }, {});
          source = apiData.map(d => {
            const idKey = d && d.id != null ? String(d.id) : null;
            if (idKey && localMap[idKey]) {
              // merge: prefer API stock (latest from database) over local stock
              // This ensures restored stock after cancellation is reflected immediately
              const local = localMap[idKey];
              return {
                ...d,
                // Prefer API stock (from database) over local storage stock
                // This ensures stock restoration is reflected immediately
                stock: Number(d.stock != null ? d.stock : (local.stock != null ? local.stock : 0)),
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
      }

      // Calculate available stock by subtracting cart quantities
      // This ensures we don't allow adding more items than available
      // Sync cart from localStorage to ensure we have the latest state
      syncCartFromStorage();
      const cartQuantities = {};
      Object.keys(cart).forEach(id => {
        if (cart[id] && cart[id].qty) {
          cartQuantities[String(id)] = Number(cart[id].qty) || 0;
        }
      });
      
      console.log('Rendering products - Cart quantities:', cartQuantities, 'Cart object:', cart);

      // Render the source array (Shopee Style)
      source.forEach(product => {
        const name = (product.name || product.names || 'Unnamed Product').toString();
        const price = Number(product.price || 0);
        const baseStock = Number(product.stock || 0);
        // Subtract cart quantity from available stock for display and validation
        const cartQty = cartQuantities[String(product.id)] || 0;
        const availableStock = Math.max(0, baseStock - cartQty);
        const category = product.category || 'Uncategorized';
        const image = product.images || 'https://via.placeholder.com/200';
        const oldPrice = price * 1.2; // Simulated old price for discount
        const discount = Math.round((1 - price / oldPrice) * 100);

        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.cursor = 'pointer';
        card.setAttribute('data-product-id', product.id);
        card.innerHTML = `
          <div class="product-image-wrapper">
            <img src="${image}" alt="${escapeHtml(name)}">
          </div>
          <div class="product-info">
            <div class="product-name">${escapeHtml(name)}</div>
            <div class="product-price-row">
              <span class="product-price">₱${price?.toFixed(2)}</span>
            </div>
            <div class="product-category">${escapeHtml(category)}</div>
            <button class="add-to-cart-btn" data-id="${product.id}" ${availableStock <= 0 ? 'disabled' : ''} onclick="event.stopPropagation();">
              ${availableStock <= 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        `;
        productList.appendChild(card);
        
        // Make card clickable to open modal
        card.addEventListener('click', (e) => {
          // Don't open modal if clicking the button
          if (e.target.closest('.add-to-cart-btn')) return;
          openProductModal(product, availableStock, baseStock, cartQty);
        });
      });

      // attach handlers to add buttons (safe)
      productList.querySelectorAll('.add-to-cart-btn').forEach(btn => {
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
    function addToCart(id, quantity = 1) {
      const product = findProduct(id);
      if (!product) {
        showNotification('Product not found', 'warning');
        console.warn('addToCart: product not found for id', id);
        return;
      }
      
      // Calculate available stock by subtracting cart quantity
      const baseStock = Number(product.stock || 0);
      const cartQty = cart[id] ? Number(cart[id].qty || 0) : 0;
      const availableStock = baseStock - cartQty;
      
      if (availableStock <= 0) {
        showNotification('Out of stock', 'warning');
        return;
      }

      const qtyToAdd = Number(quantity) || 1;
      if (cartQty + qtyToAdd > baseStock) {
        showNotification(`Only ${availableStock} items available`, 'warning');
        return;
      }

      // Don't modify product.stock directly - we calculate available stock from base stock minus cart qty
      // This ensures we always check against the real database stock
      if (!cart[id]) {
        // store minimal product snapshot (name, price, id)
        cart[id] = {
          id: product.id,
          name: product.name || product.names || 'Unnamed Product',
          price: Number(product.price) || 0,
          qty: qtyToAdd
        };
      } else {
        cart[id].qty = Number(cart[id].qty || 0) + qtyToAdd;     
      }

      persistState();
      
      // Sync cart to ensure latest state before re-rendering
      syncCartFromStorage();
      
      // Preserve current category filter when re-rendering
      if (currentCategoryFilter) {
        // Re-filter products to maintain the category view
        const categoryKey = currentCategoryFilter;
        const exactCategories = categoryMap[categoryKey] || [];
        const filtered = products.filter(p => {
          if (!p.category) return false;
          const productCategory = String(p.category).trim().toLowerCase();
          return exactCategories.some(cat => 
            productCategory === cat.trim().toLowerCase()
          );
        });
        renderProducts(filtered, true); // Use filtered list, skip API fetch
      } else {
        renderProducts(products, false); // Show all products, fetch from API
      }
      
      renderCart();
      showNotification(`Added ${qtyToAdd} ${qtyToAdd > 1 ? 'items' : 'item'} of ${product.name || product.names} to cart`, 'success');
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
      
      // Preserve current category filter when re-rendering
      if (currentCategoryFilter) {
        // Re-filter products to maintain the category view
        const categoryKey = currentCategoryFilter;
        const exactCategories = categoryMap[categoryKey] || [];
        const filtered = products.filter(p => {
          if (!p.category) return false;
          const productCategory = String(p.category).trim().toLowerCase();
          return exactCategories.some(cat => 
            productCategory === cat.trim().toLowerCase()
          );
        });
        renderProducts(filtered, true); // Use filtered list, skip API fetch
      } else {
        renderProducts(products, false); // Show all products, fetch from API
      }
      
      renderCart();
      showNotification('Removed item from cart', 'info');
    }

    // Decrease or increase qty (optional helper)
    async function changeQty(id, delta) {
      if (!cart[id]) return;
      const product = findProduct(id);
      if (!product && delta > 0) return;

      if (delta > 0) {
        // Calculate available stock by subtracting current cart quantity
        const baseStock = Number(product.stock || 0);
        const currentCartQty = Number(cart[id].qty || 0);
        const availableStock = baseStock - currentCartQty;
        
        if (availableStock <= 0) { 
          showNotification('No more stock available', 'warning'); 
          return; 
        }
        cart[id].qty += delta;
        // Don't modify product.stock - we calculate from base stock minus cart qty
      } else {
        cart[id].qty += delta;
        if (cart[id].qty <= 0) delete cart[id];
        // Don't modify product.stock - stock is restored when item is removed from cart
      }
      persistState();
      
      // Preserve current category filter when re-rendering
      if (currentCategoryFilter) {
        // Re-filter products to maintain the category view
        const categoryKey = currentCategoryFilter;
        const exactCategories = categoryMap[categoryKey] || [];
        const filtered = products.filter(p => {
          if (!p.category) return false;
          const productCategory = String(p.category).trim().toLowerCase();
          return exactCategories.some(cat => 
            productCategory === cat.trim().toLowerCase()
          );
        });
        renderProducts(filtered, true); // Use filtered list, skip API fetch
      } else {
        renderProducts(products, false); // Show all products, fetch from API
      }
      
      renderCart();
    }

    // Render cart UI (Shopee Style)
    function renderCart() {
      if (!cartItems) return;
      cartItems.innerHTML = '';
      const values = Object.values(cart);
      if (values.length === 0) {
        cartItems.innerHTML = '<p class="text-center" style="padding: 40px; color: var(--text-muted);">Your cart is empty</p>';
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
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(it.name)}</div>
            <div class="cart-item-details">₱${Number(it.price).toFixed(2)} × ${it.qty}</div>
          </div>
          <div class="cart-item-price">₱${(Number(it.price) * Number(it.qty)).toFixed(2)}</div>
          <div class="cart-item-actions">
            <button class="qty-btn cart-dec" data-id="${it.id}">−</button>
            <span class="cart-item-qty">${it.qty}</span>
            <button class="qty-btn cart-inc" data-id="${it.id}">+</button>
            <button class="remove-btn cart-rem" data-id="${it.id}">Remove</button>
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

    // Check if phone number is verified (for Checkout.html page)
    const contactInput = document.getElementById('contactnumber');
    if (contactInput) {
      // Check if OTP verification is required and completed
      const isVerified = window.isPhoneVerified && typeof window.isPhoneVerified === 'function' 
        ? window.isPhoneVerified() 
        : (window.phoneVerified === true);
      
      if (!isVerified) {
        if (window.Swal && typeof Swal.fire === 'function') {
          await Swal.fire({
            icon: 'warning',
            title: 'Phone Verification Required',
            text: 'Please verify your phone number with OTP before placing the order.',
            confirmButtonColor: '#3085d6'
          });
        } else {
          showNotification('Please verify your phone number with OTP first.', 'warning');
        }
        return;
      }
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

const contact = getFieldValue(['contactnumber'], '') ;
console.log("contact", contact);

// Compute totals
const cartItemsArr = Object.values(cart);
let total = cartItemsArr.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
let items = cartItemsArr.reduce((c, i) => c + (Number(i.qty) || 0), 0);

let gcashtr = "";
if (payment === 'GCash') {
  await Swal.fire({
   title: 'Input transaction number',
    text: 'Please scan the GCash QR code below to pay.',
    imageUrl: window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))+ '/../assets/images/gcash_qr.png', // 👈 put your QR image path here
    imageWidth: 200, // adjust size
    imageHeight: 200,
    imageAlt: 'GCash QR Code',
    input: 'text',
    inputLabel: 'GCash Transaction Number:',
    inputPlaceholder: 'Enter transaction number',
    showCancelButton: true,
    confirmButtonText: 'Confirm Payment',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    inputValidator: value => !value ? 'Transaction number is required!' : null
  }).then(result => {
    if (result.isConfirmed) {
      gcashtr = result.value;
      console.log("trnumber", gcashtr);
    } else {
      return;
    }
  });
}

// Create new order object
const newOrder = {
  id: Date.now(),
  customer,
  items: Object.values(cart), // actual item list, not just count
  total,
  payment,
  type,
  address,
  status: 'Pending',
  trnumber: gcashtr,
  contact: contact,
  createdbyuser: currentUser.username
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

  // Check if response is ok first
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: Failed to record sale`);
  }

  // Parse successful response
  const result = await response.json().catch(() => {
    // If JSON parsing fails but status is ok, assume success
    return { success: true, message: 'Order placed successfully', orderId: newOrder.id };
  });
  
  // Check if result indicates success
  if (result.success === false) {
    throw new Error(result.message || 'Failed to record sale');
  }
  
  console.log('✅ Sale recorded in backend:', result);
  
  // Store the order_id from backend response if available
  if (result.orderId) {
    newOrder.order_id = result.orderId;
    newOrder.id = result.orderId; // Also update id for consistency
  }
  
  // Update localStorage with the order_id from backend
  try {
    const existingOrders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
    // Find the order we just added (should be the last one or match by customer/total)
    const orderIndex = existingOrders.length > 0 
      ? existingOrders.length - 1 // Last order is the one we just added
      : -1;
    if (orderIndex !== -1 && existingOrders[orderIndex]) {
      existingOrders[orderIndex] = { ...existingOrders[orderIndex], ...newOrder };
      localStorage.setItem(ORDERS_KEY, JSON.stringify(existingOrders));
      console.log('✅ Updated order in localStorage with order_id:', result.orderId);
    }
  } catch (err) {
    console.error('Failed to update order in localStorage:', err);
  }
} catch (err) {
  console.error('❌ Failed to send order to backend:', err);
  if (window.Swal && typeof Swal.fire === 'function') {
    await Swal.fire({
      icon: 'error',
      title: 'Order Failed',
      text: err.message || 'Could not send order to server. Please try again.',
      confirmButtonColor: '#d33'
    });
    return; // Don't proceed if backend save failed
  } else {
    showNotification('Could not send order to server. Please try again.', 'error');
    return; // Don't proceed if backend save failed
  }
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

// Redirect to Index.html after checkout completion
const browseSection = document.getElementById('browse');
if (browseSection) {
  // If on Index.html, show browse section
  openBrowse();
} else {
  // If on Checkout.html, redirect to Index.html
  window.location.href = 'Index.html';
}
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
      const { action, product, id, allProducts, stockUpdated } = event.data;

      // Handle stock updates (when orders are cancelled/rejected and stock is restored)
      if (stockUpdated === true) {
        console.log('📦 Stock updated - refreshing products from API');
        // Force refresh from API to get latest stock values
        ensureProductsLoaded().then(() => {
          renderProducts(products);
          console.log('✅ Products refreshed with updated stock');
        });
        return;
      }

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

    // Search function - defined early to be accessible
    window.performSearch = function(query = '') {
      if (!query) {
        // If empty search, show all products
        renderProducts(products);
        return;
      }
      
      // Clear category filter when searching
      if (query.trim()) {
        currentCategoryFilter = null;
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
      }
      
      const searchLower = query.toLowerCase();
      const filtered = products.filter(p => {
        const name = (p.name || p.names || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        return name.includes(searchLower) || category.includes(searchLower);
      });
      
      if (filtered.length === 0) {
        if (productList) {
          productList.innerHTML = `<p class="text-center" style="padding: 40px; color: var(--text-muted);">No products found matching "${escapeHtml(query)}"</p>`;
        }
      } else {
        renderProducts(filtered, true); // Skip API fetch for search results
      }
      
      // Show browse section if it exists
      const browseSection = document.getElementById('browse');
      if (browseSection) {
        browseSection.classList.remove('d-none');
        const checkoutSection = document.getElementById('checkout-section');
        if (checkoutSection) checkoutSection.classList.add('d-none');
      }
    };

    // Search functionality - set up after products are loaded
    function setupSearch() {
      const searchForms = document.querySelectorAll('.search-form');
      searchForms.forEach(form => {
        // Check if listener already attached (prevent duplicates)
        if (form.dataset.searchListener === 'attached') {
          return;
        }
        
        form.dataset.searchListener = 'attached';
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const searchInput = form.querySelector('.search-input');
          const query = searchInput?.value?.trim() || '';
          
          console.log('Search submitted:', query, 'Products count:', products.length);
          
          // If on Cart.html or Checkout.html, navigate to Index.html with search
          const browseSection = document.getElementById('browse');
          if (!browseSection) {
            // Not on Index.html, navigate there
            if (query) {
              window.location.href = `Index.html?search=${encodeURIComponent(query)}`;
            } else {
              window.location.href = 'Index.html';
            }
            return;
          }
          
          // On Index.html, filter products
          if (window.performSearch && products.length > 0) {
            window.performSearch(query);
          } else {
            console.warn('Search not ready:', { 
              performSearch: !!window.performSearch, 
              productsCount: products.length 
            });
            // Retry after a short delay if products aren't loaded yet
            setTimeout(() => {
              if (window.performSearch && products.length > 0) {
                window.performSearch(query);
              }
            }, 500);
          }
        });
      });
    }

    // Category mapping: Map HTML category names to EXACT database category values
    // These MUST match exactly what's stored in the items.category column in the database
    const categoryMap = {
      'fresh produce': ['Fresh Produce'],
      'dairy': ['Dairy'],
      'snacks': ['Snacks'],
      'beverages': ['Beverages'],
      'frozen foods': ['Frozen Foods'],
      'canned goods': ['Canned Goods'],
      'household items': ['Household Items'],
      'personal care': ['Personal Care']
    };
    
    // Debug: Log the category map to verify it's correct
    console.log('Category mapping:', categoryMap);

    // Track current filter state
    let currentCategoryFilter = null;

    // Category filters (support links)
    document.querySelectorAll('.category-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Get category key from data attribute or fallback to text content
        const categoryKey = btn.dataset.category || 
                           btn.querySelector('.name')?.textContent?.trim()?.toLowerCase() || 
                           btn.textContent.replace(/[^a-zA-Z &]/g, '').trim().toLowerCase();
        
        // Get display name
        const categoryName = btn.querySelector('.name')?.textContent?.trim() || 
                            btn.textContent.replace(/[^a-zA-Z &]/g, '').trim();
        
        // Toggle: if same category clicked again, show all products
        if (currentCategoryFilter === categoryKey) {
          currentCategoryFilter = null;
          renderProducts(products, false); // Fetch fresh from API
          console.log('Showing all products (category filter cleared)');
        } else {
          currentCategoryFilter = categoryKey;
          
          console.log('Category clicked:', categoryName, 'Key:', categoryKey);
          
          // Find matching categories from the map - EXACT MATCH ONLY
          const exactCategories = categoryMap[categoryKey] || [categoryName];
          
          // Filter products by EXACT category match (case-insensitive)
          // This prevents cross-category contamination
          const filtered = products.filter(p => {
            if (!p.category) {
              console.debug('Product has no category:', p.name || p.names);
              return false;
            }
            
            const productCategory = String(p.category).trim();
            const productCategoryLower = productCategory.toLowerCase();
            
            // Only match if product category exactly matches one of the mapped categories
            const matches = exactCategories.some(cat => {
              const catLower = cat.trim().toLowerCase();
              const isMatch = productCategoryLower === catLower;
              if (isMatch) {
                console.debug(`✓ Match: "${productCategory}" === "${cat}"`);
              }
              return isMatch;
            });
            
            if (!matches) {
              console.debug(`✗ No match: Product category "${productCategory}" not in [${exactCategories.join(', ')}]`);
            }
            
            return matches;
          });
          
          console.log(`Found ${filtered.length} products for category "${categoryName}"`, {
            categoryKey,
            exactCategories,
            filtered: filtered.map(p => ({ name: p.name || p.names, category: p.category })),
            allProducts: products.map(p => ({ name: p.name || p.names, category: p.category }))
          });
          
          if (filtered.length === 0) {
            if (productList) {
              // Temporarily override grid display for centering
              productList.style.display = 'flex';
              productList.style.justifyContent = 'center';
              productList.style.alignItems = 'center';
              productList.style.minHeight = '400px';
              
              productList.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; color: var(--text-muted); width: 100%; max-width: 600px;">
                  <i class="fas fa-box-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                  <p style="font-size: 18px; margin-bottom: 8px; font-weight: 500;">No products found in ${escapeHtml(categoryName)}</p>
                  <p style="font-size: 14px; opacity: 0.7; margin-bottom: 20px;">Try browsing other categories or use the search bar.</p>
                  <button class="btn btn-primary" onclick="document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active')); window.location.reload();">
                    <i class="fas fa-redo"></i> Show All Products
                  </button>
                </div>
              `;
            }
          } else {
            // Reset to grid display when showing products
            if (productList) {
              productList.style.display = '';
              productList.style.justifyContent = '';
              productList.style.alignItems = '';
              productList.style.minHeight = '';
            }
            // Pass filtered list and skip API fetch to preserve the filter
            renderProducts(filtered, true);
          }
        }
        
        // Update active state
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Scroll to products section
        openBrowse();
        
        // Smooth scroll to products
        setTimeout(() => {
          const productsSection = document.getElementById('browse');
          if (productsSection) {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      });
    });

    // Shop now button - show all
    if (shopNowBtn) {
      shopNowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        currentCategoryFilter = null;
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
        renderProducts(products);
        openBrowse();
      });
    }

    // Cart / Checkout toggle - support multiple possible IDs to be robust
    // Note: Cart button now navigates to Cart.html, handled by HTML link
    // Checkout button in cart section (on Cart.html) - handled by Cart.html's inline script
    // Checkout button on Index.html checkout section - handled by Index.html's inline script

  // === Back Navigation Buttons ===
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;
  
  // Initialize
  ensureProductsLoaded().then(() => {
    // Initialize cart UI from storage
    renderCart();

    // Setup search functionality after products are loaded
    setupSearch();

    // Load persisted orders silently (cashier will read from same localStorage if needed)
    try {
      const persisted = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
      // nothing to do on customer side, but keep for consistency
      console.debug('Loaded persisted orders count:', Array.isArray(persisted) ? persisted.length : 0);
    } catch (err) {
      console.debug('No persisted orders found or parse error', err);
    }

    // Check if page loaded with #checkout hash and show checkout section (only on Index.html)
    if (window.location.hash === '#checkout' && checkoutSection) {
      const browseSection = document.getElementById('browse');
      if (browseSection) browseSection.classList.add('d-none');
      checkoutSection.classList.remove('d-none');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Check if page loaded with search query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    if (searchQuery && window.performSearch) {
      // Set search input value if it exists
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        searchInput.value = searchQuery;
      }
      // Perform search after products are loaded
      setTimeout(() => {
        window.performSearch(searchQuery);
      }, 100);
    }

    // Refresh products when page becomes visible (handles case when user returns after order cancellation)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // Page became visible - refresh products from API to get latest stock
        console.log('📦 Page visible - refreshing products to get latest stock');
        ensureProductsLoaded().then(() => {
          renderProducts(products);
        });
      }
    });

    // Also refresh products when window regains focus (alternative trigger)
    window.addEventListener('focus', () => {
      console.log('📦 Window focused - refreshing products to get latest stock');
      ensureProductsLoaded().then(() => {
        renderProducts(products);
      });
    });

    console.debug('Customer script initialized', { productsCount: products.length, cartCount: Object.keys(cart).length });
  }).catch(err => {
    console.error('Initialization error', err);
  });



    
    // === If user logged in or not ===
    if (!currentUser) {
    // No user logged in → show Login button
    logoutBtn.textContent = '🔑 Login';
    logoutBtn.classList.remove('btn-danger');
    logoutBtn.classList.add('btn-success');
    

    logoutBtn.addEventListener('click', () => {
      window.location.href = 'login.html';
    });
  } else {
    // User is logged in → show Logout button
    logoutBtn.textContent = '🚪 Logout';
    logoutBtn.classList.remove('btn-success');
    logoutBtn.classList.add('btn-danger');

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
      window.location.replace('Index.html');
    });
  }

  // ===== PRODUCT MODAL FUNCTIONALITY =====
  let currentModalProduct = null;
  let currentModalAvailableStock = 0;

  function openProductModal(product, availableStock, baseStock, cartQty) {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    currentModalProduct = product;
    currentModalAvailableStock = availableStock;

    // Populate modal with product data
    const name = (product.name || product.names || 'Unnamed Product').toString();
    const price = Number(product.price || 0);
    const category = product.category || 'Uncategorized';
    const image = product.images || 'https://via.placeholder.com/200';
    const description = product.descs || product.description || product.descriptions || 'No description available.';

    document.getElementById('modalProductImage').src = image;
    document.getElementById('modalProductImage').alt = name;
    document.getElementById('modalProductName').textContent = name;
    document.getElementById('modalProductPrice').textContent = `₱${price.toFixed(2)}`;
    document.getElementById('modalProductCategory').textContent = category;
    document.getElementById('modalProductDescription').textContent = description;
    
    // Stock info
    const stockInfo = availableStock > 0 
      ? `In Stock (${availableStock} available)`
      : 'Out of Stock';
    document.getElementById('modalProductStock').textContent = stockInfo;
    document.getElementById('modalProductStock').className = availableStock > 0 ? 'stock-info in-stock' : 'stock-info out-of-stock';

    // Quantity input
    const quantityInput = document.getElementById('modalQuantity');
    quantityInput.value = 1;
    quantityInput.min = 1;
    quantityInput.max = availableStock;

    // Disable add to cart if out of stock
    const addToCartBtn = document.getElementById('addToCartFromModal');
    if (availableStock <= 0) {
      addToCartBtn.disabled = true;
      addToCartBtn.innerHTML = '<i class="fas fa-ban"></i> Out of Stock';
    } else {
      addToCartBtn.disabled = false;
      addToCartBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
    }

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
    currentModalProduct = null;
    currentModalAvailableStock = 0;
  }

  // Modal event listeners
  const modal = document.getElementById('productModal');
  const closeBtn = document.getElementById('closeProductModal');
  const overlay = modal?.querySelector('.product-modal-overlay');
  const addToCartBtn = document.getElementById('addToCartFromModal');
  const decreaseBtn = document.getElementById('decreaseQuantity');
  const increaseBtn = document.getElementById('increaseQuantity');
  const quantityInput = document.getElementById('modalQuantity');

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener('click', closeProductModal);
  }

  if (overlay) {
    overlay.addEventListener('click', closeProductModal);
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeProductModal();
    }
  });

  // Quantity controls
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      const current = parseInt(quantityInput.value) || 1;
      if (current > 1) {
        quantityInput.value = current - 1;
      }
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      const current = parseInt(quantityInput.value) || 1;
      const max = parseInt(quantityInput.max) || 1;
      if (current < max) {
        quantityInput.value = current + 1;
      }
    });
  }

  // Quantity input validation
  if (quantityInput) {
    quantityInput.addEventListener('change', () => {
      const value = parseInt(quantityInput.value) || 1;
      const max = parseInt(quantityInput.max) || 1;
      const min = parseInt(quantityInput.min) || 1;
      
      if (value < min) quantityInput.value = min;
      if (value > max) quantityInput.value = max;
    });
  }

  // Add to cart from modal
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
      if (!currentModalProduct) return;
      
      const quantity = parseInt(quantityInput.value) || 1;
      if (quantity <= 0) {
        showNotification('Please select a valid quantity', 'warning');
        return;
      }

      if (quantity > currentModalAvailableStock) {
        showNotification(`Only ${currentModalAvailableStock} items available`, 'warning');
        return;
      }

      addToCart(currentModalProduct.id, quantity);
      closeProductModal();
    });
  }

  });
})();
