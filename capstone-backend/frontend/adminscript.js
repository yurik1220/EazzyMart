document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'groceryItems';
  const ORDERS_KEY = 'orders';
  
  let products = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];

  // === LISTEN FOR NEW ORDERS FROM CUSTOMERS ===
  const orderChannel = new BroadcastChannel('orders');
  orderChannel.onmessage = (event) => {
    const { action, order } = event.data;
    if (action === 'new-order' && order) {
      orders.push(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      console.log('✅ New order received:', order);
      updateStockFromOrder(order);
    }
  };

  // === UPDATE STOCK BASED ON ORDER ===
  function updateStockFromOrder(order) {
    if (!order || !Array.isArray(products)) return;

    const cart = JSON.parse(localStorage.getItem('cart')) || {};

    // For each product in the cart/order, decrease stock
    Object.values(cart).forEach(item => {
      const product = products.find(p => String(p.id) === String(item.id));
      if (product) {
        product.stock = Math.max(0, (Number(product.stock) || 0) - (Number(item.qty) || 0));
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    console.log('📦 Stock updated after order:', products);
  }
  // ===== Sidebar Navigation =====
  const navLinks = document.querySelectorAll('aside a[data-section]');
  const sections = document.querySelectorAll('.section');

  // Helper: show a section by id (hides others)
  function showSectionById(sectionId) {
    if (!sections) return;
    sections.forEach(sec => sec.classList.add('d-none'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('d-none');
  }
  
  // Attach click listeners for nav links
  navLinks.forEach(link => {
    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      // toggle active class on links
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // hide all sections and show target
      const sectionId = link.getAttribute('data-section');
      showSectionById(sectionId);

      if (sectionId === 'dashboard') updateDashboard();
    });
  });

  // --- Ensure a section is visible on first load ---
  (function ensureInitialSectionVisible() {
    // preferred: an already-active link
    let activeLink = document.querySelector('aside a[data-section].active');
    if (!activeLink) activeLink = navLinks[0]; // fallback to first link
    if (activeLink) {
      // make sure the active link is visually active
      navLinks.forEach(l => l.classList.remove('active'));
      activeLink.classList.add('active');

      const initialSection = activeLink.getAttribute('data-section');
      showSectionById(initialSection);

      // if initial is dashboard, update it
      if (initialSection === 'dashboard') {
        // call updateDashboard after a tick to ensure DOM ready
        setTimeout(() => {
          try { updateDashboard(); } catch (err) { console.warn('updateDashboard error:', err); }
        }, 0);
      }
    } else {
      // no links found — show first section fallback
      if (sections && sections.length) {
        sections.forEach((s, i) => {
          s.classList.toggle('d-none', i !== 0);
        });
      }
    }
  })();

  // ===== Global Elements =====
  const form = document.getElementById('add-item-form');
  const productList = document.getElementById('product-list');
  const reportOutput = document.getElementById('report-output');
  const searchBar = document.getElementById('search-bar');
  const updateChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('product-updates') : null;

  let items = JSON.parse(localStorage.getItem('groceryItems')) || [];
  let uploadedImageBase64 = "";
  const fileInput = document.getElementById('item-image-file');
  const imagePreview = document.getElementById('image-preview');

  // ===== Image Upload Preview =====
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = e => {
          uploadedImageBase64 = e.target.result;
          if (imagePreview) {
            imagePreview.src = uploadedImageBase64;
            imagePreview.classList.remove('d-none');
            imagePreview.style.display = "block";
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ===== Save + Broadcast =====
  function saveAndBroadcast(action, product = null, id = null) {
    localStorage.setItem('groceryItems', JSON.stringify(items));
    if (updateChannel) updateChannel.postMessage({ action, product, id, allProducts: items });
    window.dispatchEvent(new Event('storage'));
  }

  // ===== Add Item to DB =====
  async function ItemAdder(item) {
    try {
      const response = await fetch("http://localhost:3000/api/items", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });

      // if server returns created item, prefer that; otherwise fall back
      if (response.ok) {
        const data = await response.json();
        const saved = data && Object.keys(data).length ? data : item;
        items.push(saved);
        saveAndBroadcast('add', saved);
        uploadedImageBase64 = "";
        if (imagePreview) {
          imagePreview.style.display = "none";
          imagePreview.classList.add('d-none');
        }
        alert('✅ Item added successfully!');
        renderItems();
        updateDashboard();
        return saved;
      } else {
        throw new Error('Failed to add item (server responded with error)');
      }
    } catch (error) {
      console.error('Error:', error);
      // fallback: persist locally so user isn't blocked
      item.id = item.id || Date.now();
      items.push(item);
      saveAndBroadcast('add', item);
      uploadedImageBase64 = "";
      if (imagePreview) {
        imagePreview.style.display = "none";
        imagePreview.classList.add('d-none');
      }
      alert('✅ Item saved locally (server unreachable). It will sync when the server is back.');
      renderItems();
      updateDashboard();
      return item;
    }
  }

  // ===== Handle Form Submit =====
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const newItem = {
        names: (document.getElementById('item-name')?.value || '').trim(),
        category: (document.getElementById('item-category')?.value || '').trim(),
        price: parseFloat(document.getElementById('item-price')?.value || '0'),
        stock: parseInt(document.getElementById('item-stock')?.value || '0'),
        images: uploadedImageBase64 || 'https://via.placeholder.com/200',
        descs: (document.getElementById('item-description')?.value || '').trim()
      };

      if (!newItem.names || isNaN(newItem.price) || isNaN(newItem.stock)) {
        alert('⚠️ Please fill out all fields correctly.');
        return;
      }

      await ItemAdder(newItem);
      form.reset();
    });
  }

  // ===== Fetch Items (with local fallback) =====
  async function getItemsfromDB() {
    try {
      const response = await fetch('http://localhost:3000/api/items');  //failed to fetch
      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      if (Array.isArray(data)) {
        items = data;
        localStorage.setItem('groceryItems', JSON.stringify(items));
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching data:', error);    //failed to fetch
      const local = JSON.parse(localStorage.getItem('groceryItems')) || [];
      items = local;
      return local;
    }
  }

  // ===== Render Items =====
  async function renderItems(filter = '') {
    const data = await getItemsfromDB();     //failed to fetch
    if (!productList) return;
    productList.innerHTML = '';

    const filtered = (Array.isArray(data) ? data : []).filter(i => (i.names || '').toLowerCase().includes((filter || '').toLowerCase()));
    if (filtered.length === 0) {
      productList.innerHTML = '<p class="text-muted text-center mt-3">No items found.</p>';
      return;
    }

    const row = document.createElement('div');
    row.className = 'row g-3';

    filtered.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';

      const div = document.createElement('div');
      div.className = 'card shadow-sm h-100 text-center';
      div.innerHTML = `
        <img src="${item.images}" class="card-img-top" alt="${item.names}" style="height:180px; object-fit:cover;">
        <div class="card-body">
          <h5 class="card-title">${item.names}</h5>
          <p class="card-text text-success fw-bold">₱${(item.price||0).toFixed(2)}</p>
          <p class="card-text small text-muted">Stock: ${item.stock || 0}</p>
          <p class="badge bg-secondary">${item.category || ''}</p>
          <div class="d-flex justify-content-center gap-2 mt-3">
            <button class="btn btn-warning btn-sm edit">Edit</button>
            <button class="btn btn-danger btn-sm delete">Delete</button>
          </div>
        </div>
      `;

      // Delete handler
      div.querySelector('.delete')?.addEventListener('click', async () => {
        if (confirm(`Delete ${item.names}?`)) {
          try {
            const resp = await fetch(`http://localhost:3000/api/items/${item.id}`, { method: 'DELETE' });
            // Regardless of server response, update local UI
            items = items.filter(i => i.id !== item.id);
            saveAndBroadcast('delete', null, item.id);
            renderItems();
            updateDashboard();
            if (!resp.ok) alert('Item removed locally. Server delete returned an error.');
          } catch (err) {
            console.error('Delete failed:', err);
            items = items.filter(i => i.id !== item.id);
            saveAndBroadcast('delete', null, item.id);
            renderItems();
            updateDashboard();
            alert('Item removed locally. Server delete failed (server unreachable).');
          }
        }
      });

      // Edit handler (local update + broadcast; you can enhance to send PUT)
      div.querySelector('.edit')?.addEventListener('click', () => {
        const newName = prompt('Enter new name:', item.names);
        if (newName) item.names = newName.trim();
        const newPrice = prompt('Enter new price:', item.price);
        if (newPrice) item.price = parseFloat(newPrice);
        const newStock = prompt('Enter new stock:', item.stock);
        if (newStock) item.stock = parseInt(newStock);

        (async () => {
          try {
            await fetch(`http://localhost:3000/api/items/${item.id}`, {   //
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            });
          } catch (err) {
            console.warn('Server update failed, saved locally instead.');
          }
          items = items.map(i => i.id === item.id ? item : i);
          saveAndBroadcast('edit', item);
          renderItems();
          updateDashboard();
        })(); //
      });

      col.appendChild(div);
      row.appendChild(col);
    });

    productList.appendChild(row);
  }

  // initial render
  renderItems();     //failed to fetch

  // ===== Search =====
  if (searchBar) searchBar.addEventListener('input', e => renderItems(e.target.value));

  // ===== Generate Report =====
  document.getElementById('generate-report')?.addEventListener('click', () => {
  const products = JSON.parse(localStorage.getItem('groceryItems')) || [];
  const orders = JSON.parse(localStorage.getItem('orders')) || [];

  if (orders.length === 0) {
    Swal.fire('No Orders Yet', 'There are no orders to report.', 'info');
    return;
  }

  // === Calculate Total Sales ===
  const totalSales = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // === Build HTML report ===
  let html = `
    <h3>📦 Stock & Sales Report</h3>
    <p>Total Orders: ${orders.length}</p>
    <p>Total Sales: ₱${totalSales.toFixed(2)}</p>
    <table class="table table-bordered mt-3">
      <thead>
        <tr>
          <th>Product</th>
          <th>Price</th>
          <th>Remaining Stock</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td>${p.names || 'Unnamed'}</td>
            <td>₱${(Number(p.price) || 0).toFixed(2)}</td>
            <td>${p.stock}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('report-output').innerHTML = html;
});

document.getElementById('export-pdf')?.addEventListener('click', () => {
  const report = document.getElementById('report-output').innerHTML;
  const win = window.open('', '', 'width=800,height=600');
  win.document.write(`<html><head><title>Report</title></head><body>${report}</body></html>`);
  win.document.close();
  win.print();
});

  // ===== Dashboard Update =====
  function updateDashboard() {
    const localItems = JSON.parse(localStorage.getItem('groceryItems')) || [];

    const totalItems = localItems.length;
    const totalStock = localItems.reduce((sum, i) => sum + (i.stock || 0), 0);
    const totalValue = localItems.reduce((sum, i) => sum + ((i.price || 0) * (i.stock || 0)), 0);

    const elTotalItems = document.getElementById('total-items');
    const elTotalStock = document.getElementById('total-stock');
    const elTotalValue = document.getElementById('total-value');

    if (elTotalItems) elTotalItems.textContent = totalItems;
    if (elTotalStock) elTotalStock.textContent = totalStock;
    if (elTotalValue) elTotalValue.textContent = `₱${totalValue.toFixed(2)}`;

    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    recentList.innerHTML = '';

    const recentItems = localItems.slice(-5).reverse();

    if (recentItems.length === 0) {
      recentList.innerHTML = '<p class="text-muted">No items added yet.</p>';
    } else {
      const row = document.createElement('div');
      row.className = 'row g-3';
      recentItems.forEach(i => {
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-lg-3';
        col.innerHTML = `
          <div class="card shadow-sm h-100 text-center">
            <img src="${i.images}" class="card-img-top" alt="${i.names}" style="height:120px; object-fit:cover;">
            <div class="card-body p-2">
              <h6 class="card-title">${i.names}</h6>
              <p class="small text-success fw-bold">₱${(i.price||0).toFixed(2)}</p>
              <p class="badge bg-secondary">${i.category || ''}</p>
            </div>
          </div>
        `;
        row.appendChild(col);
      });
      recentList.appendChild(row);
    }

   // ===== Charts =====
const categoryCanvas = document.getElementById('categoryChart');
const stockCanvas = document.getElementById('stockChart');

if (categoryCanvas) {
  const categories = Array.from(new Set(localItems.map(i => i.category || 'Uncategorized')));
  const categoryCounts = categories.map(cat =>
    localItems.filter(i => (i.category || 'Uncategorized') === cat).length
  );

  // Destroy old instance safely
  if (window.categoryChartInstance) window.categoryChartInstance.destroy();

  window.categoryChartInstance = new Chart(categoryCanvas, {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [{
        data: categoryCounts,
        backgroundColor: categories.map((_, i) => `hsl(${i * 60 % 360}, 70%, 60%)`)
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

if (stockCanvas) {
  const productNames = localItems.map(i => i.names || 'Unnamed');
  const stockCounts = localItems.map(i => i.stock || 0);

  if (window.stockChartInstance) window.stockChartInstance.destroy();

  window.stockChartInstance = new Chart(stockCanvas, {
    type: 'bar',
    data: {
      labels: productNames,
      datasets: [{
        label: 'Stock Quantity',
        data: stockCounts,
        backgroundColor: productNames.map((_, i) => `hsl(${i * 40 % 360}, 70%, 50%)`)
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { autoSkip: false } }
      },
      plugins: {
        legend: { display: false }
      }
    }
      });
    }
  }

  updateDashboard();
  window.addEventListener('storage', updateDashboard);
});
