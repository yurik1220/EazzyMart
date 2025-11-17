document.addEventListener('DOMContentLoaded', async () => {
  const STORAGE_KEY = 'groceryItems';
  const ORDERS_KEY = 'orders';
  
  // Hide admin dashboard immediately to prevent glimpse
  const adminContainer = document.querySelector('.admin-container');
  if (adminContainer) adminContainer.style.display = 'none';
  
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  
  let products = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  let orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];

  if (!currentUser) {
    returnToIndexPage('login.html');
    return;
  } else if (currentUser.role.toLowerCase() === 'cashier') {
    returnToIndexPage('Cashier.html');
    return;
  }  else if (currentUser.role.toLowerCase() === 'customer') {
    returnToIndexPage('Index.html');
    return;
  } else {
    // ✅ Access granted for admin — show the dashboard
    if (adminContainer) {
      adminContainer.style.display = '';
      adminContainer.classList.add('visible');
    }
  }

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

  function returnToIndexPage(redirectTo) {
    // ❌ Access denied — block the page
    if (window.Swal) {
      Swal.fire({
        icon: 'error',
        title: 'Access Denied',
        text: 'You can only open the Cashier Panel from the Admin Dashboard.',
        confirmButtonColor: '#d33'
      }).then(() => {
        window.location.href = redirectTo;
      });
    } else {
      alert('Access Denied — please open from Admin Dashboard.');
      window.location.href = redirectTo;
    }
  }

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
  const sections = document.querySelectorAll('.admin-section');

  // Helper: show a section by id (hides others)
  function showSectionById(sectionId) {
    if (!sections || sections.length === 0) return;
    
    // Hide ALL admin sections first
    sections.forEach(sec => {
      sec.classList.add('d-none');
    });
    
    // Show only the target section
    const target = document.getElementById(sectionId);
    if (target) {
      target.classList.remove('d-none');
    }
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
  const fileNameDisplay = document.getElementById('file-name');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const removeImagePreviewBtn = document.getElementById('remove-image-preview');
  
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const file = this.files[0];
      if (file) {
        // Update file name display
        if (fileNameDisplay) {
          fileNameDisplay.textContent = file.name;
        }
        
        // Validate file size (2MB max)
        if (file.size > 2 * 1024 * 1024) {
          Swal.fire({
            icon: 'error',
            title: 'File Too Large',
            text: 'Please select an image smaller than 2MB.'
          });
          this.value = '';
          if (fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';
          return;
        }
        
        const reader = new FileReader();
        reader.onload = e => {
          uploadedImageBase64 = e.target.result;
          if (imagePreview) {
            imagePreview.src = uploadedImageBase64;
            if (imagePreviewContainer) {
              imagePreviewContainer.style.display = 'block';
            }
          }
        };
        reader.readAsDataURL(file);
      } else {
        if (fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      }
    });
  }
  
  // Remove image preview handler
  if (removeImagePreviewBtn) {
    removeImagePreviewBtn.addEventListener('click', function() {
      if (fileInput) fileInput.value = '';
      if (fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';
      if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      if (imagePreview) imagePreview.src = '';
      uploadedImageBase64 = null;
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
      const response = await fetch(window.getApiUrl("api/items"), {
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

      const editingId = form.dataset.editingId;
      const newItem = {
        names: (document.getElementById('item-name')?.value || '').trim(),
        category: (document.getElementById('item-category')?.value || '').trim(),
        price: parseFloat(document.getElementById('item-price')?.value || '0'),
        stock: parseInt(document.getElementById('item-stock')?.value || '0'),
        images: uploadedImageBase64 || (editingId && items.find(i => i.id == editingId)?.images) || 'https://via.placeholder.com/200',
        descs: (document.getElementById('item-description')?.value || '').trim()
      };

      if (!newItem.names || isNaN(newItem.price) || isNaN(newItem.stock)) {
        Swal.fire({
          icon: 'warning',
          title: 'Validation Error',
          text: 'Please fill out all fields correctly.'
        });
        return;
      }

      // Handle edit mode
      if (editingId) {
        newItem.id = editingId;
        try {
          const resp = await fetch(window.getApiUrl(`api/items/${editingId}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
          });
          
          if (resp.ok) {
            items = items.map(i => i.id == editingId ? newItem : i);
            saveAndBroadcast('edit', newItem);
            renderItems();
            updateDashboard();
            Swal.fire({
              icon: 'success',
              title: 'Updated',
              text: 'Product updated successfully.'
            });
          } else {
            throw new Error('Update failed');
          }
        } catch (err) {
          console.error('Update error:', err);
          items = items.map(i => i.id == editingId ? newItem : i);
          saveAndBroadcast('edit', newItem);
          renderItems();
          updateDashboard();
          Swal.fire({
            icon: 'warning',
            title: 'Updated Locally',
            text: 'Product updated locally. Server update failed.'
          });
        }
      } else {
        // Add new item
      await ItemAdder(newItem);
      }

      // Reset form
      form.reset();
      
      // Reset form UI elements
      const fileNameDisplay = document.getElementById('file-name');
      if (fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';
      
      const imagePreviewContainer = document.getElementById('image-preview-container');
      if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      
      if (imagePreview) {
        imagePreview.src = '';
      }
      
      uploadedImageBase64 = "";
      
      // Reset submit button text
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Add Item';
      
      // Clear editing ID
      delete form.dataset.editingId;
    });
  }

  // ===== Fetch Items (with local fallback) =====
  async function getItemsfromDB() {
    try {
      const response = await fetch(window.getApiUrl('api/items'));  //failed to fetch
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
    const data = await getItemsfromDB();
    if (!productList) return;
    productList.innerHTML = '';

    const filtered = (Array.isArray(data) ? data : []).filter(i => {
      const searchTerm = (filter || '').toLowerCase();
      const name = (i.names || '').toLowerCase();
      const category = (i.category || '').toLowerCase();
      const description = (i.descs || i.description || i.descriptions || '').toLowerCase();
      return name.includes(searchTerm) || category.includes(searchTerm) || description.includes(searchTerm);
    });

    if (filtered.length === 0) {
      productList.innerHTML = '<div class="empty-state">No items found.</div>';
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'admin-product-card';

      const imageUrl = item.images || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23f3f4f6%22/%3E%3C/svg%3E';
      
      card.innerHTML = `
        <div class="product-image-container">
          <img src="${imageUrl}" alt="${item.names || 'Product'}" class="product-image" 
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23f3f4f6%22/%3E%3C/svg%3E'">
        </div>
        <div class="product-card-body">
          <h3 class="product-card-name">${escapeHtml(item.names || 'Unnamed Product')}</h3>
          <p class="product-card-price">₱${(Number(item.price) || 0).toFixed(2)}</p>
          <p class="product-card-stock">Stock: ${item.stock || 0}</p>
          <span class="product-card-category">${escapeHtml(item.category || 'Uncategorized')}</span>
          <div class="product-card-actions">
            <button class="btn-edit" data-id="${item.id}">Edit</button>
            <button class="btn-delete" data-id="${item.id}">Delete</button>
          </div>
        </div>
      `;

      // Delete handler
      const deleteBtn = card.querySelector('.btn-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`Are you sure you want to delete "${item.names}"?`)) {
          try {
            const resp = await fetch(window.getApiUrl(`api/items/${item.id}`), { method: 'DELETE' });
            items = items.filter(i => i.id !== item.id);
            saveAndBroadcast('delete', null, item.id);
              renderItems(filter);
            updateDashboard();
              if (!resp.ok) {
                Swal.fire({ icon: 'warning', title: 'Warning', text: 'Item removed locally. Server delete returned an error.' });
              } else {
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Product deleted successfully.' });
              }
          } catch (err) {
            console.error('Delete failed:', err);
            items = items.filter(i => i.id !== item.id);
            saveAndBroadcast('delete', null, item.id);
              renderItems(filter);
            updateDashboard();
              Swal.fire({ icon: 'warning', title: 'Warning', text: 'Item removed locally. Server delete failed.' });
          }
        }
      });
      }

      // Edit handler - populate form and switch to Add Item section
      const editBtn = card.querySelector('.btn-edit');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          // Populate form fields
          const nameField = document.getElementById('item-name');
          const categoryField = document.getElementById('item-category');
          const priceField = document.getElementById('item-price');
          const stockField = document.getElementById('item-stock');
          const descriptionField = document.getElementById('item-description');
          const imagePreview = document.getElementById('image-preview');
          const fileInput = document.getElementById('item-image-file');
          
          if (nameField) nameField.value = item.names || '';
          if (categoryField) categoryField.value = item.category || '';
          if (priceField) priceField.value = item.price || 0;
          if (stockField) stockField.value = item.stock || 0;
          if (descriptionField) descriptionField.value = item.descs || item.description || item.descriptions || '';
          
          // Show existing image if available
          if (item.images && imagePreview) {
            imagePreview.src = item.images;
            const imagePreviewContainer = document.getElementById('image-preview-container');
            if (imagePreviewContainer) {
              imagePreviewContainer.style.display = 'block';
            }
          } else {
            const imagePreviewContainer = document.getElementById('image-preview-container');
            if (imagePreviewContainer) {
              imagePreviewContainer.style.display = 'none';
            }
          }
          
          // Clear file input
          if (fileInput) fileInput.value = '';
          const fileNameDisplay = document.getElementById('file-name');
          if (fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';
          
          // Store editing item ID
          const form = document.getElementById('add-item-form');
          if (form) {
            form.dataset.editingId = item.id;
            // Update submit button text
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Update Item';
          }
          
          // Switch to Add Item section
          const addItemLink = document.querySelector('a[data-section="add-item"]');
          if (addItemLink) {
            document.querySelectorAll('.nav-link[data-section]').forEach(l => l.classList.remove('active'));
            addItemLink.classList.add('active');
            showSectionById('add-item');
          }
        });
      }

      productList.appendChild(card);
    });
  }

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // initial render
  renderItems();     //failed to fetch

  // ===== Search =====
  if (searchBar) searchBar.addEventListener('input', e => renderItems(e.target.value));

  // ===== SALES REPORT FUNCTIONALITY =====
  let reportCurrentFilter = 'today';
  let reportFilteredOrders = [];
  let reportAllOrders = [];
  let reportAllReturnRefunds = [];

  // Initialize report when report section is shown
  const reportSection = document.getElementById('report');
  if (reportSection) {
    const reportObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isVisible = !reportSection.classList.contains('d-none');
          if (isVisible && reportAllOrders.length === 0) {
            initializeReport();
          }
        }
      });
    });

    reportObserver.observe(reportSection, { attributes: true });
  }

  async function initializeReport() {
    try {
      // Fetch all orders
      const ordersRes = await fetch(window.getApiUrl('api/sales'));
      reportAllOrders = await ordersRes.json();
      
      // Fetch return/refund requests
  try {
        const refundsRes = await fetch(window.getApiUrl('api/return-refund'));
        const refundsData = await refundsRes.json();
        reportAllReturnRefunds = refundsData.success ? refundsData.requests : [];
      } catch (err) {
        console.warn('Could not fetch return/refund data:', err);
        reportAllReturnRefunds = [];
      }

      // Get current user
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userName = currentUser.firstname && currentUser.lastname 
        ? `${currentUser.firstname} ${currentUser.lastname}`
        : (currentUser.username || 'Admin');

      // Update report header
      const generatedByEl = document.getElementById('generatedBy');
      const generatedDateEl = document.getElementById('generatedDate');
      if (generatedByEl) generatedByEl.textContent = userName;
      if (generatedDateEl) generatedDateEl.textContent = new Date().toLocaleString();

      // Setup date filters
      setupReportDateFilters();
      setupReportExportButton();

      // Apply initial filter
      applyReportDateFilter('today');
    } catch (err) {
      console.error("Error initializing report:", err);
    }
  }

  function setupReportDateFilters() {
    // Quick filter buttons
    document.querySelectorAll('.quick-filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        reportCurrentFilter = btn.dataset.filter;
        applyReportDateFilter(reportCurrentFilter);
      });
    });

    // Custom date range
    const applyCustomDateBtn = document.getElementById('applyCustomDate');
    if (applyCustomDateBtn) {
      applyCustomDateBtn.addEventListener('click', () => {
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;
        
        if (!dateFrom || !dateTo) {
          Swal.fire('Error', 'Please select both From and To dates', 'warning');
          return;
        }

        if (new Date(dateFrom) > new Date(dateTo)) {
          Swal.fire('Error', 'From date must be before To date', 'warning');
          return;
        }

        document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
        reportCurrentFilter = 'custom';
        applyReportDateFilter('custom', dateFrom, dateTo);
      });
    }
  }

  function applyReportDateFilter(filterType, customFrom = null, customTo = null) {
    const now = new Date();
    let startDate, endDate;

    switch (filterType) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'annually':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'custom':
        startDate = new Date(customFrom);
        endDate = new Date(customTo);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'all':
      default:
        startDate = null;
        endDate = null;
        break;
    }

    // Filter orders
    reportFilteredOrders = reportAllOrders.filter(order => {
      if (!startDate || !endDate) return true;
      const orderDate = new Date(order.order_date || order.createddate);
      return orderDate >= startDate && orderDate <= endDate;
    });

    // Update coverage date
    const coverageDateEl = document.getElementById('coverageDate');
    if (coverageDateEl) {
      if (startDate && endDate) {
        coverageDateEl.textContent = `${formatReportDateDisplay(startDate)} - ${formatReportDateDisplay(endDate)}`;
      } else {
        coverageDateEl.textContent = 'All Time';
      }
    }

    // Update report title
    const reportTitleEl = document.getElementById('reportTitle');
    if (reportTitleEl) {
      const titles = {
        'today': 'Daily Sales Report',
        'weekly': 'Weekly Sales Report',
        'monthly': 'Monthly Sales Report',
        'annually': 'Annual Sales Report',
        'custom': 'Custom Sales Report',
        'all': 'All Time Sales Report'
      };
      reportTitleEl.textContent = titles[filterType] || 'Sales Report';
    }

    // Update sales summary
    updateReportSalesSummary();
    
    // Render all sections
    renderReportSections();
  }

  function formatReportDateDisplay(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderReportSections() {
    updateReportSalesSummary();
    renderReportPaymentBreakdown();
    renderReportSalesByCategory();
    renderReportSalesByProduct();
    renderReportOrderList();
    renderReportRefundsSummary();
  }

  function renderReportPaymentBreakdown() {
    const completedOrders = reportFilteredOrders.filter(o => 
      o.status === 'Delivered' || o.status === 'Completed'
    );

    const paymentBreakdown = {};
    completedOrders.forEach(order => {
      const method = order.payment || 'Unknown';
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (parseFloat(order.total) || 0);
    });

    const container = document.getElementById('paymentBreakdown');
    if (!container) return;
    container.innerHTML = '';

    if (Object.keys(paymentBreakdown).length === 0) {
      container.innerHTML = '<div class="report-empty-state">No payment data available</div>';
      return;
    }

    Object.entries(paymentBreakdown).forEach(([method, total]) => {
      const div = document.createElement('div');
      div.className = 'report-grid-item';
      div.innerHTML = `
        <div class="report-grid-item-name">${method}</div>
        <div class="report-grid-item-stats">
          <div>Total: ₱${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
      container.appendChild(div);
    });
  }

  function renderReportSalesByCategory() {
    const completedOrders = reportFilteredOrders.filter(o => 
      o.status === 'Delivered' || o.status === 'Completed'
    );

    const categoryStats = {};
    completedOrders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          const category = item.category || 'Uncategorized';
          if (!categoryStats[category]) {
            categoryStats[category] = { count: 0, revenue: 0 };
          }
          const qty = parseInt(item.qty || item.quantity || 0);
          const price = parseFloat(item.price || 0);
          categoryStats[category].count += qty;
          categoryStats[category].revenue += qty * price;
        });
      }
    });

    const container = document.getElementById('salesByCategory');
    if (!container) return;
    container.innerHTML = '';

    if (Object.keys(categoryStats).length === 0) {
      container.innerHTML = '<div class="report-empty-state">No category data available</div>';
      return;
    }

    Object.entries(categoryStats)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .forEach(([category, stats]) => {
        const div = document.createElement('div');
        div.className = 'report-grid-item';
        div.innerHTML = `
          <div class="report-grid-item-name">${category}</div>
          <div class="report-grid-item-stats">
            <div>Items Sold: ${stats.count.toLocaleString()}</div>
            <div>Revenue: ₱${stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        `;
        container.appendChild(div);
      });
  }

  function renderReportSalesByProduct() {
    const completedOrders = reportFilteredOrders.filter(o => 
      o.status === 'Delivered' || o.status === 'Completed'
    );

    const productStats = {};
    completedOrders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          const productName = item.name || 'Unknown Product';
          if (!productStats[productName]) {
            productStats[productName] = {
              qty: 0,
              price: parseFloat(item.price || 0),
              total: 0,
              discount: 0
            };
          }
          const qty = parseInt(item.qty || item.quantity || 0);
          const price = parseFloat(item.price || 0);
          productStats[productName].qty += qty;
          productStats[productName].total += qty * price;
        });
      }
    });

    const tbody = document.getElementById('salesByProductBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (Object.keys(productStats).length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="report-empty-state">No product data available</td></tr>';
      return;
    }

    Object.entries(productStats)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([productName, stats]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${productName}</td>
          <td>${stats.qty.toLocaleString()}</td>
          <td>₱${stats.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td>₱${stats.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td>₱${stats.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderReportOrderList() {
    const completedOrders = reportFilteredOrders.filter(o => 
      o.status === 'Delivered' || o.status === 'Completed' || o.status === 'Refunded'
    );

    const tbody = document.getElementById('orderListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (completedOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="report-empty-state">No orders found</td></tr>';
      return;
    }

    completedOrders
      .sort((a, b) => {
        const dateA = new Date(a.order_date || a.createddate);
        const dateB = new Date(b.order_date || b.createddate);
        return dateB - dateA;
      })
      .forEach(order => {
        const tr = document.createElement('tr');
        const orderDate = new Date(order.order_date || order.createddate);
        const statusClass = (order.status || '').toLowerCase().replace(/\s+/g, '-');
        
        tr.innerHTML = `
          <td>${order.order_id || order.id}</td>
          <td>${orderDate.toLocaleString()}</td>
          <td>${order.customer || 'Guest'}</td>
          <td>₱${(parseFloat(order.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td>${order.payment || 'Unknown'}</td>
          <td><span class="status-badge ${statusClass}">${order.status || 'Unknown'}</span></td>
        `;
        tbody.appendChild(tr);
      });
  }

  function renderReportRefundsSummary() {
    const refundsInRange = reportAllReturnRefunds.filter(refund => {
      if (!refund.created_at) return false;
      const refundDate = new Date(refund.created_at);
      const startDate = getReportFilterStartDate();
      const endDate = getReportFilterEndDate();
      if (!startDate || !endDate) return true;
      return refundDate >= startDate && refundDate <= endDate;
    });

    const container = document.getElementById('refundsSummary');
    if (!container) return;
    
    if (refundsInRange.length === 0) {
      container.innerHTML = '<div class="report-empty-state">No refunds or returns in this period</div>';
      return;
    }

    const totalRefundAmount = refundsInRange
      .filter(r => r.status === 'Refunded')
      .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);

    const totalReturnedItems = refundsInRange
      .filter(r => r.status === 'Returned' || r.status === 'Refunded')
      .length;

    let html = `
      <div style="margin-bottom: var(--spacing-lg);">
        <div class="report-grid">
          <div class="report-grid-item">
            <div class="report-grid-item-name">Total Returned Items</div>
            <div class="report-grid-item-stats">${totalReturnedItems}</div>
          </div>
          <div class="report-grid-item">
            <div class="report-grid-item-name">Total Refund Amount</div>
            <div class="report-grid-item-stats">₱${totalRefundAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>
      <div class="report-table-wrapper">
        <table class="report-table">
          <thead>
          <tr>
              <th>Order ID</th>
            <th>Customer</th>
            <th>Reason</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Created</th>
          </tr>
        </thead>
        <tbody>
    `;

    refundsInRange.forEach(refund => {
      const statusClass = (refund.status || '').toLowerCase().replace(/\s+/g, '-');
      const createdDate = new Date(refund.created_at);
      
      html += `
        <tr>
          <td>${refund.order_id || '-'}</td>
          <td>${refund.customer_name || '-'}</td>
          <td style="max-width: 200px;">${(refund.reason || '-').substring(0, 50)}${(refund.reason || '').length > 50 ? '...' : ''}</td>
          <td>${refund.request_type || '-'}</td>
          <td>₱${(parseFloat(refund.total_amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td><span class="status-badge ${statusClass}">${refund.status || '-'}</span></td>
          <td>${createdDate.toLocaleDateString()}</td>
            </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      </div>
    `;

    container.innerHTML = html;
  }

  function getReportFilterStartDate() {
    const now = new Date();
    switch (reportCurrentFilter) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        const dayOfWeek = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        return start;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'annually':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return null;
    }
  }

  function getReportFilterEndDate() {
    const now = new Date();
    switch (reportCurrentFilter) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      case 'weekly':
        const dayOfWeek = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return end;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      case 'annually':
        return new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      default:
        return null;
    }
  }

  function setupReportExportButton() {
    const exportBtn = document.getElementById('exportPdfBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportReportToPDF);
    }
  }

  function exportReportToPDF() {
    if (!window.jspdf) {
      Swal.fire('Error', 'PDF library not loaded. Please refresh the page.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    // Report Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Eazzy Mart', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Report title based on current filter
    const titles = {
      'today': 'Daily Sales Report',
      'weekly': 'Weekly Sales Report',
      'monthly': 'Monthly Sales Report',
      'annually': 'Annual Sales Report',
      'custom': 'Custom Sales Report',
      'all': 'All Time Sales Report'
    };
    const reportTitle = titles[reportCurrentFilter] || 'Sales Report';
    doc.setFontSize(16);
    doc.setFont(undefined, 'normal');
    doc.text(reportTitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Report Info
    doc.setFontSize(10);
    const coverageDateEl = document.getElementById('coverageDate');
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userName = currentUser.firstname && currentUser.lastname 
      ? `${currentUser.firstname} ${currentUser.lastname}`
      : (currentUser.username || 'Admin');
    
    if (coverageDateEl) {
      doc.text(`Coverage Date: ${coverageDateEl.textContent}`, margin, yPos);
      yPos += 5;
    }
    doc.text(`Generated By: ${userName}`, margin, yPos);
    yPos += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 10;

    // Sales Summary
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Sales Summary', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const summaryData = [
      ['Total Sales Amount', document.getElementById('totalSalesAmount')?.textContent || '₱0.00'],
      ['Total Orders', document.getElementById('totalOrders')?.textContent || '0'],
      ['Total Items Sold', document.getElementById('totalItemsSold')?.textContent || '0'],
      ['Average Order Value', document.getElementById('averageOrderValue')?.textContent || '₱0.00'],
      ['Total Discounts', document.getElementById('totalDiscounts')?.textContent || '₱0.00'],
      ['Total Refunds', document.getElementById('totalRefunds')?.textContent || '₱0.00'],
      ['Net Sales', document.getElementById('netSales')?.textContent || '₱0.00']
    ];

    doc.autoTable({
      startY: yPos,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [0, 102, 204] },
      margin: { left: margin, right: margin }
    });

    yPos = doc.lastAutoTable.finalY + 10;

    // Payment Breakdown
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Payment Breakdown', margin, yPos);
    yPos += 8;

    const paymentItems = Array.from(document.querySelectorAll('#paymentBreakdown .report-grid-item'));
    const paymentData = paymentItems.map(item => [
      item.querySelector('.report-grid-item-name')?.textContent || '',
      item.querySelector('.report-grid-item-stats')?.textContent.trim() || ''
    ]).filter(row => row[0] !== '');

    if (paymentData.length > 0) {
      doc.autoTable({
        startY: yPos,
        head: [['Payment Method', 'Total']],
        body: paymentData,
        theme: 'striped',
        headStyles: { fillColor: [0, 102, 204] },
        margin: { left: margin, right: margin }
      });
      yPos = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('No payment data available', margin, yPos);
      yPos += 10;
    }

    // Sales by Category
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Sales by Category', margin, yPos);
    yPos += 8;

    const categoryItems = Array.from(document.querySelectorAll('#salesByCategory .report-grid-item'));
    const categoryData = categoryItems.map(item => {
      const name = item.querySelector('.report-grid-item-name')?.textContent || '';
      const stats = item.querySelector('.report-grid-item-stats')?.textContent || '';
      // Parse stats to extract items sold and revenue
      const itemsMatch = stats.match(/Items Sold:\s*(\d+)/);
      const revenueMatch = stats.match(/Revenue:\s*₱([\d,]+\.?\d*)/);
      return [
        name,
        itemsMatch ? itemsMatch[1] : '0',
        revenueMatch ? `₱${revenueMatch[1]}` : '₱0.00'
      ];
    }).filter(row => row[0] !== '');

    if (categoryData.length > 0) {
      doc.autoTable({
        startY: yPos,
        head: [['Category', 'Items Sold', 'Revenue']],
        body: categoryData,
        theme: 'striped',
        headStyles: { fillColor: [0, 102, 204] },
        margin: { left: margin, right: margin }
      });
      yPos = doc.lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('No category data available', margin, yPos);
      yPos += 10;
    }

    // Sales by Product
    const productRows = Array.from(document.querySelectorAll('#salesByProductBody tr'));
    if (productRows.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Sales by Product', margin, yPos);
      yPos += 8;

      const productData = productRows.map(tr => {
        const tds = tr.querySelectorAll('td');
        return [
          tds[0]?.textContent || '',
          tds[1]?.textContent || '',
          tds[2]?.textContent || '',
          tds[3]?.textContent || '',
          tds[4]?.textContent || ''
        ];
      }).filter(row => row[0] !== '');

      if (productData.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [['Product Name', 'Qty Sold', 'Price', 'Total Sales', 'Discount']],
          body: productData,
          theme: 'striped',
          headStyles: { fillColor: [0, 102, 204] },
          margin: { left: margin, right: margin },
          styles: { fontSize: 8 }
        });
        yPos = doc.lastAutoTable.finalY + 10;
      }
    }

    // Order List
    const orderRows = Array.from(document.querySelectorAll('#orderListBody tr'));
    if (orderRows.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Order List', margin, yPos);
      yPos += 8;

      const orderData = orderRows.map(tr => {
        const tds = tr.querySelectorAll('td');
        return [
          tds[0]?.textContent || '',
          tds[1]?.textContent || '',
          tds[2]?.textContent || '',
          tds[3]?.textContent || '',
          tds[4]?.textContent || '',
          tds[5]?.textContent || ''
        ];
      }).filter(row => row[0] !== '' && !row[0].includes('No orders found'));

      if (orderData.length > 0) {
        doc.autoTable({
          startY: yPos,
          head: [['Order ID', 'Date/Time', 'Customer', 'Total', 'Payment', 'Status']],
          body: orderData,
          theme: 'striped',
          headStyles: { fillColor: [0, 102, 204] },
          margin: { left: margin, right: margin },
          styles: { fontSize: 8 }
        });
        yPos = doc.lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('No orders found', margin, yPos);
        yPos += 10;
      }
    }

    // Refunds / Returns Summary
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Refunds / Returns Summary', margin, yPos);
    yPos += 8;

    // Get refunds summary data
    const refundsSummaryEl = document.getElementById('refundsSummary');
    if (refundsSummaryEl) {
      const refundsTable = refundsSummaryEl.querySelector('.report-table');
      if (refundsTable) {
        const refundRows = Array.from(refundsTable.querySelectorAll('tbody tr'));
        if (refundRows.length > 0) {
          const refundData = refundRows.map(tr => {
            const tds = tr.querySelectorAll('td');
            return [
              tds[0]?.textContent || '',
              tds[1]?.textContent || '',
              (tds[2]?.textContent || '').substring(0, 40), // Truncate reason
              tds[3]?.textContent || '',
              tds[4]?.textContent || '',
              tds[5]?.textContent || '',
              tds[6]?.textContent || ''
            ];
          }).filter(row => row[0] !== '');

          if (refundData.length > 0) {
            doc.autoTable({
              startY: yPos,
              head: [['Order ID', 'Customer', 'Reason', 'Type', 'Amount', 'Status', 'Created']],
              body: refundData,
              theme: 'striped',
              headStyles: { fillColor: [0, 102, 204] },
              margin: { left: margin, right: margin },
              styles: { fontSize: 7 }
            });
            yPos = doc.lastAutoTable.finalY + 10;
          }
        } else {
          // Try to get summary cards
          const summaryCards = refundsSummaryEl.querySelectorAll('.report-grid-item');
          if (summaryCards.length > 0) {
            const summaryData = Array.from(summaryCards).map(card => {
              const name = card.querySelector('.report-grid-item-name')?.textContent || '';
              const stats = card.querySelector('.report-grid-item-stats')?.textContent || '';
              return [name, stats];
            });
            
            doc.autoTable({
              startY: yPos,
              head: [['Metric', 'Value']],
              body: summaryData,
              theme: 'striped',
              headStyles: { fillColor: [0, 102, 204] },
              margin: { left: margin, right: margin }
            });
            yPos = doc.lastAutoTable.finalY + 10;
          } else {
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('No refunds or returns in this period', margin, yPos);
            yPos += 10;
          }
        }
      } else {
        // Check if there's a summary grid
        const summaryCards = refundsSummaryEl.querySelectorAll('.report-grid-item');
        if (summaryCards.length > 0) {
          const summaryData = Array.from(summaryCards).map(card => {
            const name = card.querySelector('.report-grid-item-name')?.textContent || '';
            const stats = card.querySelector('.report-grid-item-stats')?.textContent || '';
            return [name, stats];
          });
          
          doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [0, 102, 204] },
            margin: { left: margin, right: margin }
          });
          yPos = doc.lastAutoTable.finalY + 10;
        } else {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.text('No refunds or returns in this period', margin, yPos);
          yPos += 10;
        }
      }
    } else {
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('No refunds or returns in this period', margin, yPos);
      yPos += 10;
    }

    // Save PDF
    const fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  // Update sales summary when orders change
  function updateReportSalesSummary() {
    const completedOrders = reportFilteredOrders.filter(o => 
      o.status === 'Delivered' || o.status === 'Completed'
    );

    const totalSalesAmount = completedOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const totalOrders = completedOrders.length;
    
    let totalItemsSold = 0;
    completedOrders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          totalItemsSold += parseInt(item.qty || item.quantity || 0);
        });
      }
    });

    const averageOrderValue = totalOrders > 0 ? totalSalesAmount / totalOrders : 0;
    
    const refundsInRange = reportAllReturnRefunds.filter(refund => {
      if (!refund.created_at) return false;
      const refundDate = new Date(refund.created_at);
      const startDate = getReportFilterStartDate();
      const endDate = getReportFilterEndDate();
      if (!startDate || !endDate) return true;
      return refundDate >= startDate && refundDate <= endDate;
    });
    
    const totalRefunds = refundsInRange
      .filter(r => r.status === 'Refunded')
      .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);

    const totalDiscounts = 0;
    const netSales = totalSalesAmount - totalRefunds - totalDiscounts;

    const totalSalesAmountEl = document.getElementById('totalSalesAmount');
    const totalOrdersEl = document.getElementById('totalOrders');
    const totalItemsSoldEl = document.getElementById('totalItemsSold');
    const averageOrderValueEl = document.getElementById('averageOrderValue');
    const totalDiscountsEl = document.getElementById('totalDiscounts');
    const totalRefundsEl = document.getElementById('totalRefunds');
    const netSalesEl = document.getElementById('netSales');

    if (totalSalesAmountEl) totalSalesAmountEl.textContent = `₱${totalSalesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders.toLocaleString();
    if (totalItemsSoldEl) totalItemsSoldEl.textContent = totalItemsSold.toLocaleString();
    if (averageOrderValueEl) averageOrderValueEl.textContent = `₱${averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalDiscountsEl) totalDiscountsEl.textContent = `₱${totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (totalRefundsEl) totalRefundsEl.textContent = `₱${totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (netSalesEl) netSalesEl.textContent = `₱${netSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);

  if (isNaN(date)) return dateString; // fallback if invalid date format

  // Example: "Nov 10, 2025, 2:35 PM"
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

  // ===== Dashboard Update =====
  async function updateDashboard() {
    await getItemsfromDB();
    const localItems = items || [];

    // Fetch orders and sales data
    let allOrders = [];
    try {
      const ordersRes = await fetch(window.getApiUrl('api/sales'));
      if (ordersRes.ok) {
        allOrders = await ordersRes.json();
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      // Fallback to localStorage
      allOrders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
    }

    // Fetch customers
    let customers = [];
    try {
      const usersRes = await fetch(window.getApiUrl('api/user'));
      if (usersRes.ok) {
        const users = await usersRes.json();
        customers = users.filter(u => u.role && u.role.toLowerCase() === 'customer');
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }

    // Fetch refunds
    let allRefunds = [];
    try {
      const refundsRes = await fetch(window.getApiUrl('api/return-refund'));
      if (refundsRes.ok) {
        const refundsData = await refundsRes.json();
        allRefunds = refundsData.success ? refundsData.requests : [];
      }
    } catch (err) {
      console.error('Error fetching refunds:', err);
    }

    // Calculate totals
    const totalProducts = localItems.length;
    const grossSales = allOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalRefunds = allRefunds
      .filter(r => r.status === 'Refunded')
      .reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
    const totalSales = grossSales - totalRefunds;
    const totalOrders = allOrders.length;
    const totalCustomers = customers.length;

    // Update stat cards
    const elTotalSales = document.getElementById('total-sales');
    const elTotalOrders = document.getElementById('total-orders');
    const elTotalCustomers = document.getElementById('total-customers');
    const elTotalProducts = document.getElementById('total-products');

    if (elTotalSales) elTotalSales.textContent = `₱${totalSales.toFixed(2)}`;
    if (elTotalOrders) elTotalOrders.textContent = totalOrders;
    if (elTotalCustomers) elTotalCustomers.textContent = totalCustomers;
    if (elTotalProducts) elTotalProducts.textContent = totalProducts;

    // Top Selling Products
    updateTopProducts(localItems, allOrders);

    // Low Stock Alerts
    updateLowStock(localItems);

    // Recent Orders
    updateRecentOrders(allOrders);

    // Pending Actions
    updatePendingActions(allOrders);

    // Update Charts
    await generateCharts(localItems, allOrders);
  }

  function updateTopProducts(products, orders) {
    const topProductsList = document.getElementById('top-products-list');
    if (!topProductsList) return;

    // Calculate sales per product
    const productSales = {};
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const productId = String(item.id || item.productId || '');
          if (!productSales[productId]) {
            productSales[productId] = { qty: 0, name: item.name || 'Unknown', image: item.image || '' };
          }
          productSales[productId].qty += Number(item.qty || 0);
        });
      }
    });

    // Sort by quantity sold
    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    if (topProducts.length === 0) {
      topProductsList.innerHTML = '<div class="empty-state">No sales data available</div>';
      return;
    }

    topProductsList.innerHTML = topProducts.map(product => `
      <div class="product-item">
        <img src="${product.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Crect width=%2250%22 height=%2250%22 fill=%22%23f3f4f6%22/%3E%3C/svg%3E'}" 
             alt="${product.name}" class="product-item-image" 
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22%3E%3Crect width=%2250%22 height=%2250%22 fill=%22%23f3f4f6%22/%3E%3C/svg%3E'">
        <div class="product-item-info">
          <div class="product-item-name">${product.name}</div>
          <div class="product-item-meta">${product.qty} sold</div>
            </div>
        <div class="product-item-sales">${product.qty}x</div>
      </div>
    `).join('');
  }

  function updateLowStock(products) {
    const lowStockList = document.getElementById('low-stock-list');
    const lowStockCount = document.getElementById('low-stock-count');
    if (!lowStockList) return;

    const lowStockItems = products.filter(p => (Number(p.stock) || 0) < 10).slice(0, 5);

    if (lowStockCount) {
      lowStockCount.textContent = products.filter(p => (Number(p.stock) || 0) < 10).length;
    }

    if (lowStockItems.length === 0) {
      lowStockList.innerHTML = '<div class="empty-state">No low stock items</div>';
      return;
    }

    lowStockList.innerHTML = lowStockItems.map(item => `
      <div class="alert-item">
        <div class="alert-item-info">
          <div class="alert-item-name">${item.names || 'Unnamed Product'}</div>
          <div class="alert-item-stock">Only ${item.stock || 0} units remaining</div>
        </div>
      </div>
    `).join('');
  }

  function updateRecentOrders(orders) {
    const recentOrdersList = document.getElementById('recent-orders-list');
    if (!recentOrdersList) return;

    const recentOrders = orders
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 5);

    if (recentOrders.length === 0) {
      recentOrdersList.innerHTML = '<div class="empty-state">No recent orders</div>';
      return;
    }

    recentOrdersList.innerHTML = recentOrders.map(order => {
      const status = (order.status || 'Pending').toLowerCase();
      return `
        <div class="order-item">
          <div class="order-item-info">
            <div class="order-item-id">Order #${order.id || order.order_id || 'N/A'}</div>
            <div class="order-item-meta">${order.customer || 'Unknown'} • ₱${(Number(order.total) || 0).toFixed(2)}</div>
          </div>
          <span class="order-item-status ${status}">${order.status || 'Pending'}</span>
          </div>
        `;
    }).join('');
  }

  function updatePendingActions(orders) {
    const pendingActionsList = document.getElementById('pending-actions-list');
    const pendingActionsCount = document.getElementById('pending-actions-count');
    if (!pendingActionsList) return;

    const pendingOrders = orders.filter(o => {
      const status = (o.status || '').toLowerCase();
      return ['pending', 'in process'].includes(status);
      });

    const returnRefundRequests = []; // TODO: Fetch from API if available

    const pendingActions = [
      ...pendingOrders.slice(0, 3).map(o => ({
        type: 'Order Review',
        details: `Order #${o.id || o.order_id} needs review`
      })),
      ...returnRefundRequests.slice(0, 2).map(r => ({
        type: 'Return/Refund',
        details: `Order #${r.order_id} - ${r.request_type}`
      }))
    ].slice(0, 5);

    if (pendingActionsCount) {
      pendingActionsCount.textContent = pendingOrders.length + returnRefundRequests.length;
    }

    if (pendingActions.length === 0) {
      pendingActionsList.innerHTML = '<div class="empty-state">No pending actions</div>';
      return;
    }

    pendingActionsList.innerHTML = pendingActions.map(action => `
      <div class="action-item">
        <div class="action-item-info">
          <div class="action-item-type">${action.type}</div>
          <div class="action-item-details">${action.details}</div>
        </div>
      </div>
    `).join('');
  }

updateDashboard();
window.addEventListener('storage', updateDashboard);

  // ===== Logout Functionality =====
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Swal.fire({
        title: 'Are you sure?',
        text: 'You will be logged out of your session.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, logout'
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.removeItem('currentUser');
          Swal.fire({
            icon: 'success',
            title: 'Logged Out',
            text: 'You have been successfully logged out.',
            confirmButtonColor: '#28a745'
          }).then(() => {
            window.location.href = 'Index.html';
          });
        }
      });
    });
  }

// ===== Charts =====
let currentSalesPeriod = 'daily';
let salesChartInstance = null;

async function generateCharts(localItems, orders) {
  const categoryCanvas = document.getElementById('categoryChart');
  const salesCanvas = document.getElementById('salesChart');

  // Category Distribution Chart
  if (categoryCanvas) {
    const categories = Array.from(new Set(localItems.map(i => i.category || 'Uncategorized')));
    const categoryCounts = categories.map(cat =>
      localItems.filter(i => (i.category || 'Uncategorized') === cat).length
    );

    if (window.categoryChartInstance) window.categoryChartInstance.destroy();

    window.categoryChartInstance = new Chart(categoryCanvas, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data: categoryCounts,
          backgroundColor: [
            '#f97316',
            '#f59e0b',
            '#10b981',
            '#3b82f6',
            '#8b5cf6',
            '#ec4899',
            '#ef4444',
            '#14b8a6'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }
        },
        plugins: {
          legend: { 
            position: 'bottom',
            labels: { 
              padding: 10, 
              usePointStyle: true,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  // Sales Analysis Chart
  if (salesCanvas) {
    updateSalesChart(orders, currentSalesPeriod);
    
    // Chart period buttons - remove old listeners and add new ones
    document.querySelectorAll('.chart-period-btn').forEach(btn => {
      // Remove existing listeners by cloning and replacing
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', () => {
        document.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
        newBtn.classList.add('active');
        currentSalesPeriod = newBtn.dataset.period;
        updateSalesChart(orders, currentSalesPeriod);
      });
    });
  }
}

function updateSalesChart(orders, period) {
  const salesCanvas = document.getElementById('salesChart');
  if (!salesCanvas) return;

  // Group orders by period
  const now = new Date();
  const salesData = {};
  const labels = [];

  if (period === 'daily') {
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(dateStr);
      salesData[dateStr] = 0;
    }
  } else if (period === 'weekly') {
    // Last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - (i * 7));
      const weekStr = `Week ${4 - i}`;
      labels.push(weekStr);
      salesData[weekStr] = 0;
    }
  } else if (period === 'monthly') {
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toLocaleDateString('en-US', { month: 'short' });
      labels.push(monthStr);
      salesData[monthStr] = 0;
    }
  }

  // Filter only completed/delivered orders for sales analysis
  const completedOrders = orders.filter(order => 
    order.status === 'Delivered' || 
    order.status === 'Completed' || 
    order.status === 'Accepted' ||
    !order.status // Include orders without status if they have a total
  );

  // Calculate sales for each period
  completedOrders.forEach(order => {
    // Try multiple date fields
    const orderDateStr = order.order_date || order.createddate || order.createdAt || order.date;
    if (!orderDateStr) return;
    
    const orderDate = new Date(orderDateStr);
    if (isNaN(orderDate.getTime())) return; // Invalid date
    
    const orderTotal = Number(order.total) || 0;
    if (orderTotal <= 0) return; // Skip orders with no total

    if (period === 'daily') {
      const dateStr = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (salesData.hasOwnProperty(dateStr)) {
        salesData[dateStr] += orderTotal;
      }
    } else if (period === 'weekly') {
      const daysDiff = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 28) { // Last 4 weeks
        const weekNum = Math.floor(daysDiff / 7);
        if (weekNum >= 0 && weekNum <= 3) {
          const weekStr = `Week ${4 - weekNum}`;
          if (salesData.hasOwnProperty(weekStr)) {
            salesData[weekStr] += orderTotal;
          }
        }
      }
    } else if (period === 'monthly') {
      // Check if order is within last 6 months
      const monthsDiff = (now.getFullYear() - orderDate.getFullYear()) * 12 + (now.getMonth() - orderDate.getMonth());
      if (monthsDiff >= 0 && monthsDiff < 6) {
        const monthStr = orderDate.toLocaleDateString('en-US', { month: 'short' });
        if (salesData.hasOwnProperty(monthStr)) {
          salesData[monthStr] += orderTotal;
        }
      }
    }
  });

  const salesValues = labels.map(label => salesData[label] || 0);

  if (salesChartInstance) salesChartInstance.destroy();

  salesChartInstance = new Chart(salesCanvas, {
    type: 'line',
        data: {
      labels: labels,
          datasets: [{
        label: 'Sales (₱)',
        data: salesValues,
        borderColor: '#0066CC',
        backgroundColor: 'rgba(0, 102, 204, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#0066CC',
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 10,
          bottom: 10,
          left: 10,
          right: 10
        }
          },
          plugins: {
        legend: { 
          display: false 
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          callbacks: {
            label: function(context) {
              return 'Sales: ₱' + context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            callback: function(value) {
              return '₱' + value.toLocaleString();
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          ticks: {
            font: { size: 10 }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}
});
