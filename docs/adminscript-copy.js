document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('login-section');
  const dashboardWrapper = document.querySelector('main');

  dashboardWrapper.style.display = 'd-none'; // hide dashboard initially

  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('http://localhost:3000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.success) {
  Swal.fire({
    icon: 'success',
    title: 'Login Successful',
    showConfirmButton: true
  }).then(() => {
    loginSection.classList.add('animate__animated', 'animate__fadeOut');

    setTimeout(() => {
      loginSection.classList.add('d-none');
      loginSection.classList.remove('animate__fadeOut', 'animate__animated');

      dashboardWrapper.classList.remove('d-none');
      dashboardWrapper.classList.add('animate__animated', 'animate__fadeIn');

      // Wait for fadeIn animation to finish BEFORE updating charts
      setTimeout(() => {
        dashboardWrapper.classList.remove('animate__fadeIn', 'animate__animated');

        // NOW safe to render charts and update dashboard
        if (typeof updateDashboard === 'function') updateDashboard();

        // Optional: force Chart.js to recalc size (helps if canvas still behaves weird)
        setTimeout(() => {
          if (window.categoryChartInstance) window.categoryChartInstance.resize();
          if (window.stockChartInstance) window.stockChartInstance.resize();
        }, 50);

      }, 500); // match fadeIn duration

    }, 500); // match fadeOut duration

  });
} else {
  Swal.fire({
    icon: 'error',
    title: 'Login Failed',
    text: data.message || 'Invalid credentials'
  });
}
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Could not reach login server'
      });
    }
  });
  // ====== OPEN CASHIER PANEL (Bootstrap + SweetAlert style) ======
const openCashierBtn = document.getElementById('openCashierBtn');
if (openCashierBtn) {
  openCashierBtn.addEventListener('click', async () => {
    const confirmOpen = await Swal.fire({
      title: 'Open Cashier Panel?',
      text: 'This will open the Cashier dashboard in a new tab.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, open it!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d'
    });

    if (!confirmOpen.isConfirmed) return;

    // ✅ Grant cashier access before opening
    sessionStorage.setItem('cashier_access', 'granted');

    await Swal.fire({
      title: 'Opening Cashier Panel...',
      icon: 'success',
      timer: 900,
      showConfirmButton: false
    });

    // ✅ Open the Cashier dashboard
    window.open('Cashier.html', '_blank');
  });
}

  // ===== STORAGE & ORDERS =====
  const STORAGE_KEY = 'groceryItems';
  const ORDERS_KEY = 'orders';
  let items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
  let stockHistory = JSON.parse(localStorage.getItem('stockHistory')) || {};

function updateStockHistory(items) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  items.forEach(i => {
    if (!stockHistory[i.id]) stockHistory[i.id] = [];
    stockHistory[i.id].push({ time: timestamp, stock: i.stock || 0 });
    if (stockHistory[i.id].length > 20) stockHistory[i.id].shift(); // keep last 20 points
  });
  localStorage.setItem('stockHistory', JSON.stringify(stockHistory));
}

function updateStockChartLive(items) {
  if (!window.stockChartInstance) return;

  items.forEach((item, idx) => {
    const history = stockHistory[item.id] || [];
    const dataset = window.stockChartInstance.data.datasets[idx];

    if (!dataset) return; // skip if dataset doesn't exist yet

    const lastPoint = history[history.length - 1];
    if (lastPoint) {
      dataset.data.push({ x: lastPoint.time, y: lastPoint.stock });
      if (dataset.data.length > 20) dataset.data.shift(); // keep last 20 points
    }
  });

  window.stockChartInstance.update('none'); // update chart without animation flicker
}

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

  async function updateStockFromOrder(order) {
    if (!order || !Array.isArray(order.items)) return;

    for (const item of order.items) {
      try {
        const res = await fetch('http://localhost:3000/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, quantitySold: item.qty })
        });

        if (!res.ok) throw new Error('Failed to record sale');
      } catch (err) {
        console.error('Error recording sale for item', item.id, err);
        Swal.fire({
          icon: 'error',
          title: 'Stock Update Failed',
          text: `Could not update stock for ${item.name}`
        });
      }

      // update local stock
      const localItem = items.find(i => i.id === item.id);
      if (localItem) {
        localItem.stock -= item.qty;
        if (localItem.stock < 0) localItem.stock = 0;
      }
    }

  updateStockHistory(items);        // save the new stock point
  updateStockChartLive(items);      // update the line chart live
  await updateDashboard();          // update totals, pie chart, and recent items
  }

  // ===== SIDEBAR NAVIGATION =====
  const navLinks = document.querySelectorAll('aside a[data-section]');
  const sections = document.querySelectorAll('.section');

  function showSectionById(sectionId) {
    sections.forEach(sec => sec.classList.add('d-none'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('d-none');
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const sectionId = link.getAttribute('data-section');
      showSectionById(sectionId);
      if (sectionId === 'dashboard') updateDashboard();
    });
  });

  (function initSection() {
    let activeLink = document.querySelector('aside a[data-section].active') || navLinks[0];
    if (activeLink) {
      navLinks.forEach(l => l.classList.remove('active'));
      activeLink.classList.add('active');
      showSectionById(activeLink.getAttribute('data-section'));
      if (activeLink.getAttribute('data-section') === 'dashboard') {
        setTimeout(updateDashboard, 0);
      }
    }
  })();

  // ===== IMAGE UPLOAD =====
  const fileInput = document.getElementById('item-image-file');
  let uploadedImageBase64 = "";
  const imagePreview = document.getElementById('image-preview');

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
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
    });
  }

  // ===== ADD ITEM =====
  const form = document.getElementById('add-item-form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();

    const newItem = {
      names: (document.getElementById('item-name')?.value || '').trim(),
      category: (document.getElementById('item-category')?.value || '').trim(),
      price: parseFloat(document.getElementById('item-price')?.value || '0'),
      stock: parseInt(document.getElementById('item-stock')?.value || '0'),
      originalStock: parseInt(document.getElementById('item-stock')?.value || '0'),
      images: uploadedImageBase64 || 'https://via.placeholder.com/200',
      descs: (document.getElementById('item-description')?.value || '').trim()
    };

    if (!newItem.names || isNaN(newItem.price) || isNaN(newItem.stock)) {
      return Swal.fire({ icon: 'warning', title: 'Invalid Input', text: 'Please fill all fields correctly.' });
    }

    await ItemAdder(newItem);
    form.reset();
  });

  async function ItemAdder(item) {
    try {
      const response = await fetch("http://localhost:3000/api/items", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });

      let savedItem;
      if (response.ok) {
        const data = await response.json();
        savedItem = data && Object.keys(data).length ? data : item;
        items.push(savedItem);
        saveAndBroadcast('add', savedItem);
        Swal.fire({ icon: 'success', title: 'Item Added', text: `"${savedItem.names}" added successfully!`, timer: 1500, showConfirmButton: false });
      } else {
        throw new Error('Server error');
      }

      uploadedImageBase64 = "";
      if (imagePreview) imagePreview.style.display = "none";
      updateStockHistory(items);
      renderItems();
      updateDashboard();
      return savedItem;

    } catch (error) {
      console.error(error);
      item.id = item.id || Date.now();
      items.push(item);
      saveAndBroadcast('add', item);

      uploadedImageBase64 = "";
      if (imagePreview) imagePreview.style.display = "none";

      Swal.fire({ icon: 'warning', title: 'Saved Locally', text: `"${item.names}" saved locally. Server unreachable.`, timer: 2500, showConfirmButton: false });

      updateStockHistory(items);        // add initial stock to history
      updateStockChartLive(items);      // show it on the chart
      renderItems();
      updateDashboard();
      return item;
    }
  }

  // ===== FETCH + RENDER ITEMS =====
  const productList = document.getElementById('product-list');
  async function getItemsfromDB() {
    try {
      const response = await fetch('http://localhost:3000/api/items');
      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      if (Array.isArray(data)) {
        items = data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
      return data;
    } catch {
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      items = local;
      return local;
    }
  }

  async function renderItems(filter = '') {
    const data = await getItemsfromDB();
    if (!productList) return;
    productList.innerHTML = '';

    const filtered = (Array.isArray(data) ? data : []).filter(i => (i.names || '').toLowerCase().includes((filter || '').toLowerCase()));
    if (!filtered.length) {
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

      // Delete
      div.querySelector('.delete')?.addEventListener('click', async () => {
        const result = await Swal.fire({ title: `Delete "${item.names}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, delete it!', cancelButtonText: 'Cancel' });
        if (result.isConfirmed) {
          try { await fetch(`http://localhost:3000/api/items/${item.id}`, { method: 'DELETE' }); } catch {}
          items = items.filter(i => i.id !== item.id);
          saveAndBroadcast('delete', null, item.id);
          updateStockHistory(items);
          renderItems();
          updateDashboard();
          Swal.fire({ icon: 'success', title: 'Deleted!', text: `"${item.names}" has been deleted.`, timer: 1500, showConfirmButton: false });
        }
      });

      // Edit
      div.querySelector('.edit')?.addEventListener('click', async () => {
        const { value: newName } = await Swal.fire({ title: 'Edit Name', input: 'text', inputValue: item.names });
        if (newName) item.names = newName.trim();
        const { value: newPrice } = await Swal.fire({ title: 'Edit Price', input: 'number', inputValue: item.price });
        if (newPrice) item.price = parseFloat(newPrice);
        const { value: newStock } = await Swal.fire({ title: 'Edit Stock', input: 'number', inputValue: item.stock });
        if (newStock) item.stock = parseInt(newStock);

        try {
          await fetch(`http://localhost:3000/api/items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
        } catch { console.warn('Server update failed, saved locally'); }

        items = items.map(i => i.id === item.id ? item : i);
        saveAndBroadcast('edit', item);
        updateStockHistory(items);        // update stock history
        updateStockChartLive(items);      // live chart update
        renderItems();
        updateDashboard();

        Swal.fire({ icon: 'success', title: 'Item Updated!', text: `"${item.names}" updated successfully.`, timer: 1500, showConfirmButton: false });
      });

      col.appendChild(div);
      row.appendChild(col);
    });

    productList.appendChild(row);
  }

  renderItems();

  // ===== SEARCH =====
  const searchBar = document.getElementById('search-bar');
  searchBar?.addEventListener('input', e => renderItems(e.target.value));

  // ===== REPORT =====
  document.getElementById('generate-report')?.addEventListener('click', () => {
    const products = JSON.parse(localStorage.getItem('groceryItems')) || [];
    const orders = JSON.parse(localStorage.getItem('orders')) || [];
    if (!orders.length) return Swal.fire('No Orders Yet', 'There are no orders to report.', 'info');

    const totalSales = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    let html = `
      <h3>📦 Stock & Sales Report</h3>
      <p>Total Orders: ${orders.length}</p>
      <p>Total Sales: ₱${totalSales.toFixed(2)}</p>
      <table class="table table-bordered mt-3">
        <thead>
          <tr><th>Product</th><th>Price</th><th>Remaining Stock</th></tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.names || 'Unnamed'}</td>
              <td>₱${(Number(p.price) || 0).toFixed(2)}</td>
              <td>${p.stock}</td>
            </tr>`).join('')}
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

  // ===== DASHBOARD UPDATE =====
  async function updateDashboard() {
  try {
    const response = await fetch('http://localhost:3000/api/items');
    const items = await response.json();

    document.getElementById('total-items').textContent = items.length;
    document.getElementById('total-stock').textContent = items.reduce((sum, i) => sum + (i.stock || 0), 0);
    document.getElementById('total-value').textContent = `₱${items.reduce((sum, i) => sum + ((i.price || 0) * (i.stock || 0)), 0).toFixed(2)}`;

    const recentList = document.getElementById('recent-list');
    if (!recentList) return;
    recentList.innerHTML = '';

    const recentItems = items.slice(-5).reverse();
    if (!recentItems.length) recentList.innerHTML = '<p class="text-muted">No items added yet.</p>';
    else {
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
          </div>`;
        row.appendChild(col);
      });
      recentList.appendChild(row);
    }

    updateStockHistory(items);
    updateCharts(items);
  } catch (err) {
    console.error('Failed to fetch items for dashboard', err);
  }
}

// ====== Real-Time Product Update Listener (from Cashier) ======
const updateChannel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('product-updates')
    : null;

if (updateChannel) {
  updateChannel.onmessage = (event) => {
    if (event.data && event.data.action === 'refresh') {
      console.log('🔄 Received refresh signal from cashier panel — updating dashboard...');
      if (typeof updateDashboard === 'function') updateDashboard();
    }
  };
}

// ===== INITIAL LOAD =====
updateDashboard();
window.addEventListener('storage', updateDashboard);

  //updateCharts
  async function updateCharts(localItems) {
  const categoryCanvas = document.getElementById('categoryChart');
  const stockCanvas = document.getElementById('stockChart');

  // ===== CATEGORY PIE CHART =====
  if (categoryCanvas) {
    const categories = Array.from(new Set(localItems.map(i => i.category || 'Uncategorized')));
    const categoryCounts = categories.map(cat => localItems.filter(i => (i.category || 'Uncategorized') === cat).length);

    if (window.categoryChartInstance) window.categoryChartInstance.destroy();

    window.categoryChartInstance = new Chart(categoryCanvas, {
      type: 'pie',
      data: { labels: categories, datasets: [{ data: categoryCounts, backgroundColor: categories.map((_, i) => `hsl(${i * 60 % 360}, 70%, 60%)`) }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // ===== STOCK LINE CHART =====
  if (stockCanvas) {
    const datasets = localItems.map((i, idx) => {
      const history = stockHistory[i.id] || [];
      return {
        label: i.names || 'Unnamed',
        data: history.map(h => ({ x: h.time, y: h.stock })),
        borderColor: `hsl(${idx*40%360},70%,50%)`,
        backgroundColor: `hsla(${idx*40%360},70%,50%,0.2)`,
        fill: false,
        tension: 0.3
      };
    });

    if (window.stockChartInstance) window.stockChartInstance.destroy();

    window.stockChartInstance = new Chart(stockCanvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        animation: false,
        scales: { 
          x: { type: 'category', title: { display: true, text: 'Time' } },
          y: { beginAtZero: true, title: { display: true, text: 'Stock Quantity' } }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

  updateDashboard();
  window.addEventListener('storage', updateDashboard);
});
