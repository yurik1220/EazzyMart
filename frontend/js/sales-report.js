// ======== SALES REPORT ========
let currentFilter = 'today';
let filteredOrders = [];
let allOrders = [];
let allReturnRefunds = [];

document.addEventListener("DOMContentLoaded", async () => {
  await initializeReport();
  setupDateFilters();
  setupExportButton();
});

async function initializeReport() {
  try {
    // Fetch all orders
    const ordersRes = await fetch(window.getApiUrl('api/sales'));
    allOrders = await ordersRes.json();
    
    // Fetch return/refund requests
    try {
      const refundsRes = await fetch(window.getApiUrl('api/return-refund'));
      const refundsData = await refundsRes.json();
      allReturnRefunds = refundsData.success ? refundsData.requests : [];
    } catch (err) {
      console.warn('Could not fetch return/refund data:', err);
      allReturnRefunds = [];
    }

    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userName = currentUser.firstname && currentUser.lastname 
      ? `${currentUser.firstname} ${currentUser.lastname}`
      : (currentUser.username || 'Admin');

    // Update report header
    document.getElementById('generatedBy').textContent = userName;
    document.getElementById('generatedDate').textContent = new Date().toLocaleString();

    // Apply initial filter
    applyDateFilter('today');
  } catch (err) {
    console.error("Error initializing report:", err);
    alert("Error loading sales report. Please try again.");
  }
}

function setupDateFilters() {
  // Quick filter buttons
  document.querySelectorAll('.quick-filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyDateFilter(currentFilter);
    });
  });

  // Custom date range
  document.getElementById('applyCustomDate').addEventListener('click', () => {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    if (!dateFrom || !dateTo) {
      alert('Please select both From and To dates');
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      alert('From date must be before To date');
      return;
    }

    document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
    currentFilter = 'custom';
    applyDateFilter('custom', dateFrom, dateTo);
  });
}

function applyDateFilter(filterType, customFrom = null, customTo = null) {
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
  filteredOrders = allOrders.filter(order => {
    if (!startDate || !endDate) return true;
    const orderDate = new Date(order.order_date || order.createddate);
    return orderDate >= startDate && orderDate <= endDate;
  });

  // Update coverage date
  const coverageDateEl = document.getElementById('coverageDate');
  if (startDate && endDate) {
    coverageDateEl.textContent = `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;
  } else {
    coverageDateEl.textContent = 'All Time';
  }

  // Update report title
  const reportTitleEl = document.getElementById('reportTitle');
  const titles = {
    'today': 'Daily Sales Report',
    'weekly': 'Weekly Sales Report',
    'monthly': 'Monthly Sales Report',
    'annually': 'Annual Sales Report',
    'custom': 'Custom Sales Report',
    'all': 'All Time Sales Report'
  };
  reportTitleEl.textContent = titles[filterType] || 'Sales Report';

  // Render all sections
  renderSalesSummary();
  renderPaymentBreakdown();
  renderSalesByCategory();
  renderSalesByProduct();
  renderOrderList();
  renderRefundsSummary();
}

function formatDateDisplay(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ======== RENDER SECTIONS ========

function renderSalesSummary() {
  const completedOrders = filteredOrders.filter(o => 
    o.status === 'Delivered' || o.status === 'Completed'
  );

  const totalSalesAmount = completedOrders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
  const totalOrders = completedOrders.length;
  
  // Calculate total items sold
  let totalItemsSold = 0;
  completedOrders.forEach(order => {
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        totalItemsSold += parseInt(item.qty || item.quantity || 0);
      });
    }
  });

  const averageOrderValue = totalOrders > 0 ? totalSalesAmount / totalOrders : 0;
  
  // Calculate refunds
  const refundsInRange = allReturnRefunds.filter(refund => {
    if (!refund.created_at) return false;
    const refundDate = new Date(refund.created_at);
    const startDate = getFilterStartDate();
    const endDate = getFilterEndDate();
    if (!startDate || !endDate) return true;
    return refundDate >= startDate && refundDate <= endDate;
  });
  
  const totalRefunds = refundsInRange
    .filter(r => r.status === 'Refunded')
    .reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);

  const totalDiscounts = 0; // TODO: Calculate if discount field exists
  const netSales = totalSalesAmount - totalRefunds - totalDiscounts;

  // Update DOM
  document.getElementById('totalSalesAmount').textContent = `₱${totalSalesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('totalOrders').textContent = totalOrders.toLocaleString();
  document.getElementById('totalItemsSold').textContent = totalItemsSold.toLocaleString();
  document.getElementById('averageOrderValue').textContent = `₱${averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('totalDiscounts').textContent = `₱${totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('totalRefunds').textContent = `₱${totalRefunds.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('netSales').textContent = `₱${netSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderPaymentBreakdown() {
  const completedOrders = filteredOrders.filter(o => 
    o.status === 'Delivered' || o.status === 'Completed'
  );

  const paymentBreakdown = {};
  completedOrders.forEach(order => {
    const method = order.payment || 'Unknown';
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (parseFloat(order.total) || 0);
  });

  const container = document.getElementById('paymentBreakdown');
  container.innerHTML = '';

  if (Object.keys(paymentBreakdown).length === 0) {
    container.innerHTML = '<div class="empty-state">No payment data available</div>';
    return;
  }

  Object.entries(paymentBreakdown).forEach(([method, total]) => {
    const div = document.createElement('div');
    div.className = 'category-item';
    div.innerHTML = `
      <div class="category-item-name">${method}</div>
      <div class="category-item-stats">
        <div>Total: ₱${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderSalesByCategory() {
  const completedOrders = filteredOrders.filter(o => 
    o.status === 'Delivered' || o.status === 'Completed'
  );

  const categoryStats = {};
  completedOrders.forEach(order => {
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        // Try to get category from item or use 'Uncategorized'
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
  container.innerHTML = '';

  if (Object.keys(categoryStats).length === 0) {
    container.innerHTML = '<div class="empty-state">No category data available</div>';
    return;
  }

  Object.entries(categoryStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .forEach(([category, stats]) => {
      const div = document.createElement('div');
      div.className = 'category-item';
      div.innerHTML = `
        <div class="category-item-name">${category}</div>
        <div class="category-item-stats">
          <div>Items Sold: ${stats.count.toLocaleString()}</div>
          <div>Revenue: ₱${stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
      container.appendChild(div);
    });
}

function renderSalesByProduct() {
  const completedOrders = filteredOrders.filter(o => 
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
  tbody.innerHTML = '';

  if (Object.keys(productStats).length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No product data available</td></tr>';
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

function renderOrderList() {
  const completedOrders = filteredOrders.filter(o => 
    o.status === 'Delivered' || o.status === 'Completed' || o.status === 'Refunded'
  );

  const tbody = document.getElementById('orderListBody');
  tbody.innerHTML = '';

  if (completedOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No orders found</td></tr>';
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

function renderRefundsSummary() {
  const refundsInRange = allReturnRefunds.filter(refund => {
    if (!refund.created_at) return false;
    const refundDate = new Date(refund.created_at);
    const startDate = getFilterStartDate();
    const endDate = getFilterEndDate();
    if (!startDate || !endDate) return true;
    return refundDate >= startDate && refundDate <= endDate;
  });

  const container = document.getElementById('refundsSummary');
  
  if (refundsInRange.length === 0) {
    container.innerHTML = '<div class="empty-state">No refunds or returns in this period</div>';
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
      <div class="category-grid">
        <div class="category-item">
          <div class="category-item-name">Total Returned Items</div>
          <div class="category-item-stats">${totalReturnedItems}</div>
        </div>
        <div class="category-item">
          <div class="category-item-name">Total Refund Amount</div>
          <div class="category-item-stats">₱${totalRefundAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
    <div class="table-wrapper">
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

function getFilterStartDate() {
  const now = new Date();
  switch (currentFilter) {
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

function getFilterEndDate() {
  const now = new Date();
  switch (currentFilter) {
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

// ======== PDF EXPORT ========

function setupExportButton() {
  document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
}

function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Report Header
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('Eazzy Mart', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(16);
  doc.setFont(undefined, 'normal');
  doc.text(document.getElementById('reportTitle').textContent, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Report Info
  doc.setFontSize(10);
  doc.text(`Coverage Date: ${document.getElementById('coverageDate').textContent}`, margin, yPos);
  yPos += 5;
  doc.text(`Generated By: ${document.getElementById('generatedBy').textContent}`, margin, yPos);
  yPos += 5;
  doc.text(`Generated: ${document.getElementById('generatedDate').textContent}`, margin, yPos);
  yPos += 10;

  // Sales Summary
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Sales Summary', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  const summaryData = [
    ['Total Sales Amount', document.getElementById('totalSalesAmount').textContent],
    ['Total Orders', document.getElementById('totalOrders').textContent],
    ['Total Items Sold', document.getElementById('totalItemsSold').textContent],
    ['Average Order Value', document.getElementById('averageOrderValue').textContent],
    ['Total Discounts', document.getElementById('totalDiscounts').textContent],
    ['Total Refunds', document.getElementById('totalRefunds').textContent],
    ['Net Sales', document.getElementById('netSales').textContent]
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

  const paymentItems = Array.from(document.querySelectorAll('#paymentBreakdown .category-item'));
  const paymentData = paymentItems.map(item => [
    item.querySelector('.category-item-name').textContent,
    item.querySelector('.category-item-stats').textContent.trim()
  ]);

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
  }

  // Sales by Product
  if (yPos > 250) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Sales by Product', margin, yPos);
  yPos += 8;

  const productRows = Array.from(document.querySelectorAll('#salesByProductBody tr'));
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

  // Order List
  if (yPos > 250) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Order List', margin, yPos);
  yPos += 8;

  const orderRows = Array.from(document.querySelectorAll('#orderListBody tr'));
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
  }).filter(row => row[0] !== '');

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
  }

  // Save PDF
  const fileName = `Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
