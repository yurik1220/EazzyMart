// ======== CASHIER.JS (Session-based security + Bootstrap + SweetAlert) ========

document.addEventListener('DOMContentLoaded', async () => {
  const dashboard = document.getElementById('cashier-dashboard');
  if (dashboard) dashboard.style.display = 'none'; // hide dashboard initially

  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    // return to index page
    returnToIndexPage('Index.html');
  } else if (currentUser.role.toLowerCase() === 'customer') {
    returnToIndexPage('Index.html');
  } else {

    // ✅ Access granted — show the dashboard
    sessionStorage.removeItem('cashier_access');

    if (dashboard) {
      dashboard.style.display = 'block';
      dashboard.classList.add('visible'); // optional fade-in effect
    }

    await initializeCashier();
    initializeLogout();
  }
});

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

async function onUpdateIsDelivered(select, orderId) {
  const isDelivered = select.value;
  console.log('Updating delivery status for order:', orderId, 'isDelivered:', isDelivered);
  
  Swal.fire({
    icon: 'success',
    title: isDelivered === "1" ? 'Order has been Delivered.'
                               : 'Order has not Delivered yet.',
    showConfirmButton: false,
    timer: 1200
  }).then(async () => {
    try {
      // Try new endpoint first (using order_id)
      let resp = await fetch(window.getApiUrl(`api/orders/${orderId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: isDelivered === "1" ? 'Delivered' : 'Out for Delivery'
        })
      });

      // If that fails, try old endpoint
      if (!resp.ok) {
        resp = await fetch(window.getApiUrl('api/sales/delivered'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId,
            isDelivered: isDelivered
          })
        });
      }

      if (!resp.ok) {
        const error = await resp.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to update delivery status');
      }
    } catch (err) {
      console.error('Error updating delivery status:', err);
      Swal.fire({
        icon: 'error',
        title: 'Update failed',
        text: err.message || 'Could not update delivery status.'
      });
    }
  });
}

// ======== CASHIER LOGIC ========
async function initializeCashier() {
  let orders = await getOrdersAPI() || [];
  let currentFilter = 'all'; // Track current filter status

  const tableBody = document.getElementById('orders-table-body');
  const emptyMessage = document.getElementById('empty-message');
  const refreshBtn = document.getElementById('refreshBtn');

  // Single broadcast channel used where needed
  const productUpdateChannel = new BroadcastChannel('product-updates');

  // ======== Tab Management ========
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const ordersSection = document.getElementById('orders-list').closest('.cashier-table-card');
    const returnRefundSection = document.getElementById('return-refund-section');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const status = button.getAttribute('data-status');
        currentFilter = status;
        
        // Update active tab
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Show/hide sections based on tab
        if (status === 'return-refund') {
          if (ordersSection) ordersSection.style.display = 'none';
          if (returnRefundSection) returnRefundSection.style.display = 'block';
          await renderReturnRefundRequests();
        } else {
          if (ordersSection) ordersSection.style.display = 'block';
          if (returnRefundSection) returnRefundSection.style.display = 'none';
          await renderOrders();
        }
      });
    });
  }

  // ======== Update Tab Counts ========
  async function updateTabCounts(allOrders) {
    const counts = {
      all: allOrders.length,
      Pending: 0,
      'In Process': 0,
      'Out for Delivery': 0,
      Delivered: 0,
      Cancelled: 0,
      'return-refund': 0
    };

    allOrders.forEach(order => {
      const status = order.status || '';
      if (status === 'Pending') counts.Pending++;
      else if (status === 'In Process' || status === 'Accepted') counts['In Process']++;
      else if (status === 'Out for Delivery') counts['Out for Delivery']++;
      else if (status === 'Delivered') counts.Delivered++;
      else if (status === 'Cancelled' || status === 'Rejected') counts.Cancelled++;
    });

    // Fetch return/refund requests count
    try {
      const response = await fetch(window.getApiUrl('api/return-refund'));
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.requests) {
          counts['return-refund'] = data.requests.length;
        }
      }
    } catch (error) {
      console.error('Error fetching return/refund count:', error);
    }

    // Update count displays
    document.getElementById('all-count').textContent = counts.all;
    document.getElementById('pending-count').textContent = counts.Pending;
    document.getElementById('inprocess-count').textContent = counts['In Process'];
    document.getElementById('outfordelivery-count').textContent = counts['Out for Delivery'];
    document.getElementById('delivered-count').textContent = counts.Delivered;
    document.getElementById('cancelled-count').textContent = counts.Cancelled;
    document.getElementById('return-refund-count').textContent = counts['return-refund'];
  }

  // ======== Filter Orders by Status ========
  function filterOrdersByStatus(allOrders, status) {
    if (status === 'all') {
      return allOrders;
    }
    
    return allOrders.filter(order => {
      const orderStatus = order.status || '';
      if (status === 'Cancelled') {
        return orderStatus === 'Cancelled' || orderStatus === 'Rejected';
      } else if (status === 'In Process') {
        return orderStatus === 'In Process' || orderStatus === 'Accepted';
      }
      return orderStatus === status;
    });
  }

  // ======== Render Orders ========
  async function renderOrders() {
    const allOrders = await getOrdersAPI() || [];
    orders = filterOrdersByStatus(allOrders, currentFilter);
    
    // Update tab counts with all orders
    updateTabCounts(allOrders);
    
    tableBody.innerHTML = '';

    if (!orders.length) {
      emptyMessage.classList.remove('d-none');
      return;
    } else {
      emptyMessage.classList.add('d-none');
    }

    orders.forEach(order => {
      const tr = document.createElement('tr');
      const orderId = order.order_id || order.id;

      // Removed "Is Delivered?" dropdown - status is now managed through action buttons

      // Payment badge
      let paymentBadge = '';
      const pay = (order.payment || '').toLowerCase();
      // Check for 'gcash' first since 'gcash' contains 'cash'
      if (pay.includes('gcash')) paymentBadge = `<span class="badge bg-info text-dark">GCash</span>`;
      else if (pay.includes('cash')) paymentBadge = `<span class="badge bg-secondary">Cash On Delivery</span>`;
      else paymentBadge = `<span class="badge bg-dark">Unknown</span>`;

      // Order type badge
      const typeBadge = order.type === 'Delivery'
        ? `<span class="badge bg-primary">Delivery</span>`
        : `<span class="badge bg-warning text-dark">Pickup</span>`;

      // Status color
      let badgeClass = '';
      const status = order.status || '';
      switch (status) {
        case 'Pending': badgeClass = 'bg-warning text-dark'; break;
        case 'Accepted':
        case 'In Process': badgeClass = 'bg-success'; break;
        case 'Ready for Pick up': badgeClass = 'bg-warning'; break;
        case 'Rejected':
        case 'Cancelled': badgeClass = 'bg-danger'; break;
        case 'Out for Delivery': badgeClass = 'bg-info'; break;
        case 'Delivered':
        case 'Completed': badgeClass = 'bg-primary'; break;
        default: badgeClass = 'bg-secondary';
      }

      // Items display: "Apple (2), Banana (1)"
      const itemsDisplay = Array.isArray(order.items)
        ? order.items.map(i => `${i.name ?? 'Item'} (${i.qty ?? 0})`).join(', ')
        : (order.items ?? '');

      tr.innerHTML = `
        <td>${orderId}</td>
        <td>${order.customer}</td>
        <td>${itemsDisplay}</td>
        <td>₱${Number(order.total).toFixed(2)}</td>
        <td>${paymentBadge}</td>
        <td>${typeBadge}</td>
        <td>${order.type === 'Pickup' ? 'N/A' : (order.address || '')}</td>
        <td>${order.contact || ''}</td>
        <td>${order.trnumber || ''}</td>
        <td><span class="badge ${badgeClass} status-badge">${order.status}</span></td>
        <td>
          ${
            order.status === 'Pending' ? `
              <button class="btn btn-sm btn-success btn-accept me-1" data-id="${orderId}">
                <i class="bi bi-check-circle"></i> Accept
              </button>
              <button class="btn btn-sm btn-danger btn-reject" data-id="${orderId}">
                <i class="bi bi-x-circle"></i> Reject
              </button>
            ` : (order.status === 'Accepted' || order.status === 'In Process') ? `
              ${order.type === 'Pickup' || order.type === 'Pick up' ? `
                <button class="btn btn-sm btn-warning btn-ready-for-pickup" data-id="${orderId}">
                  <i class="bi bi-box-seam"></i> Ready for Pick up
                </button>
              ` : `
                <button class="btn btn-sm btn-info btn-out-for-delivery" data-id="${orderId}">
                  <i class="bi bi-truck"></i> Out for Delivery
                </button>
              `}
            ` : order.status === 'Ready for Pick up' ? `
              <button class="btn btn-sm btn-primary btn-completed" data-id="${orderId}">
                <i class="bi bi-check2-circle"></i> Mark Completed
              </button>
            ` : order.status === 'Out for Delivery' ? `
              ${order.type === 'Delivery' ? `
                <button class="btn btn-sm btn-secondary btn-update-delivery-time me-1" data-id="${orderId}" title="Update Estimated Delivery Time">
                  <i class="bi bi-clock"></i> Set Delivery Time
                </button>
              ` : ''}
              <button class="btn btn-sm btn-primary btn-delivered" data-id="${orderId}">
                <i class="bi bi-check2-circle"></i> Mark Delivered
              </button>
            ` : order.status === 'Delivered' || order.status === 'Completed' ? `
              <button class="btn btn-sm btn-success" disabled>
                <i class="bi bi-check-circle-fill"></i> ${order.status === 'Completed' ? 'Completed' : 'Delivered'}
              </button>
            ` : (order.status === 'Rejected' || order.status === 'Cancelled') ? `
              <button class="btn btn-sm btn-dark" disabled>
                <i class="bi bi-x-lg"></i> ${order.status === 'Rejected' ? 'Rejected' : 'Cancelled'}
              </button>
              ${order.reason ? `<br><small class="text-danger">Reason: ${order.reason}</small>` : ''}
            ` : `
              <button class="btn btn-sm btn-info" disabled>
                <i class="bi bi-info-circle"></i> ${order.status || 'Unknown'}
              </button>
            `
          }
        </td>
        <td> 
          <button class="btn btn-sm btn-view" data-id="${orderId}"> 
            <i class="bi bi-eye-fill"></i> 
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    attachButtonEvents();
  }

  // ======== Render Return/Refund Requests ========
  async function renderReturnRefundRequests() {
    const tableBody = document.getElementById('return-refund-table-body');
    const emptyMessage = document.getElementById('return-refund-empty-message');
    
    try {
      const response = await fetch(window.getApiUrl('api/return-refund'));
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch return/refund requests');
      }

      const requests = data.requests || [];
      tableBody.innerHTML = '';

      if (requests.length === 0) {
        emptyMessage.classList.remove('d-none');
        return;
      } else {
        emptyMessage.classList.add('d-none');
      }

      requests.forEach((request, index) => {
        const tr = document.createElement('tr');
        
        // Status badge
        let statusBadge = '';
        switch (request.status) {
          case 'Pending':
            statusBadge = '<span class="badge bg-warning text-dark">Pending</span>';
            break;
          case 'Approved':
            statusBadge = '<span class="badge bg-info">Approved</span>';
            break;
          case 'Returned':
            statusBadge = '<span class="badge bg-success">Returned</span>';
            break;
          case 'Refunded':
            statusBadge = '<span class="badge bg-primary">Refunded</span>';
            break;
          case 'Rejected':
            statusBadge = '<span class="badge bg-danger">Rejected</span>';
            break;
          default:
            statusBadge = `<span class="badge bg-secondary">${request.status}</span>`;
        }

        // Image preview
        let imageCell = '<span class="text-muted">No image</span>';
        if (request.image_path) {
          const imageUrl = `${window.API_BASE_URL}/${request.image_path}`;
          imageCell = `<a href="${imageUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
            <i class="bi bi-image"></i> View
          </a>`;
        }

        // Action buttons based on status
        let actionButtons = '';
        if (request.status === 'Pending') {
          actionButtons = `
            <button class="btn btn-sm btn-success me-1" onclick="updateReturnRefundStatus(${request.id}, 'Approved')">
              <i class="bi bi-check-circle"></i> Approve
            </button>
            <button class="btn btn-sm btn-danger" onclick="updateReturnRefundStatus(${request.id}, 'Rejected')">
              <i class="bi bi-x-circle"></i> Reject
            </button>
          `;
        } else if (request.status === 'Approved') {
          if (request.request_type === 'Return') {
            actionButtons = `
              <button class="btn btn-sm btn-primary" onclick="updateReturnRefundStatus(${request.id}, 'Returned')">
                <i class="bi bi-check2-circle"></i> Mark Returned
              </button>
            `;
          } else {
            actionButtons = `
              <button class="btn btn-sm btn-primary" onclick="updateReturnRefundStatus(${request.id}, 'Refunded')">
                <i class="bi bi-check2-circle"></i> Mark Refunded
              </button>
            `;
          }
        } else {
          actionButtons = '<span class="text-muted">Completed</span>';
        }

        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${request.order_id}</td>
          <td>${request.customer_name || 'N/A'}</td>
          <td style="max-width: 200px; text-align: left;">
            <small>${escapeHtml(request.reason)}</small>
            ${request.admin_notes ? `<br><small class="text-muted"><strong>Admin:</strong> ${escapeHtml(request.admin_notes)}</small>` : ''}
          </td>
          <td><span class="badge ${request.request_type === 'Refund' ? 'bg-danger' : 'bg-warning'}">${request.request_type}</span></td>
          <td>₱${Number(request.total_amount || 0).toFixed(2)}</td>
          <td>${imageCell}</td>
          <td>${statusBadge}</td>
          <td><small>${new Date(request.created_at).toLocaleDateString()}</small></td>
          <td>${actionButtons}</td>
        `;

        tableBody.appendChild(tr);
      });
    } catch (error) {
      console.error('Error rendering return/refund requests:', error);
      tableBody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error loading requests: ${error.message}</td></tr>`;
    }
  }

  // Update return/refund request status
  window.updateReturnRefundStatus = async function(requestId, newStatus) {
    try {
      let adminNotes = '';
      
      // Prompt for admin notes if rejecting
      if (newStatus === 'Rejected') {
        const result = await Swal.fire({
          title: 'Reject Request?',
          input: 'textarea',
          inputLabel: 'Reason for rejection:',
          inputPlaceholder: 'Enter reason for rejection...',
          showCancelButton: true,
          confirmButtonText: 'Reject',
          confirmButtonColor: '#d33',
          inputValidator: (value) => {
            if (!value) {
              return 'You must provide a reason!';
            }
          }
        });

        if (!result.isConfirmed) return;
        adminNotes = result.value;
      } else if (newStatus === 'Refunded') {
        const result = await Swal.fire({
          title: 'Mark as Refunded?',
          text: 'Confirm that the refund has been processed.',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Confirm',
          confirmButtonColor: '#28a745'
        });

        if (!result.isConfirmed) return;
      }

      const response = await fetch(window.getApiUrl(`api/return-refund/${requestId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, admin_notes: adminNotes })
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Failed to update request status');
      }

      Swal.fire({
        icon: 'success',
        title: 'Status Updated',
        text: `Request status updated to ${newStatus}`,
        timer: 2000,
        showConfirmButton: false
      });

      // Refresh the return/refund requests list
      renderReturnRefundRequests();
      // Also refresh tab counts
      const allOrders = await getOrdersAPI() || [];
      await updateTabCounts(allOrders);
    } catch (error) {
      console.error('Error updating return/refund status:', error);
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: error.message || 'Failed to update request status'
      });
    }
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function getOrdersAPI() {
    const res = await fetch(window.getApiUrl('api/sales'));
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    return data;
  }

  // ======== Button Actions ========
  function attachButtonEvents() {
    document.querySelectorAll('.btn-accept').forEach(btn => {
      btn.onclick = () => {
        updateStatus(btn.dataset.id, 'Accepted');
      };
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
      btn.onclick = () => promptRejectReason(btn.dataset.id);
    });

    document.querySelectorAll('.btn-out-for-delivery').forEach(btn => {
      btn.onclick = () => {
        promptEstimatedDeliveryTime(btn.dataset.id);
      };
    });

    document.querySelectorAll('.btn-ready-for-pickup').forEach(btn => {
      btn.onclick = () => {
        updateStatus(btn.dataset.id, 'Ready for Pick up');
      };
    });

    document.querySelectorAll('.btn-update-delivery-time').forEach(btn => {
      btn.onclick = () => {
        promptEstimatedDeliveryTime(btn.dataset.id, true); // true = update mode
      };
    });

    document.querySelectorAll('.btn-delivered').forEach(btn => {
      btn.onclick = () => {
        updateStatus(btn.dataset.id, 'Delivered');
      };
    });

    document.querySelectorAll('.btn-completed').forEach(btn => {
      btn.onclick = () => {
        updateStatus(btn.dataset.id, 'Completed');
      };
    });

    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.onclick = () => {
        let display = "Orders \n \n";
        const id = btn.dataset.id;
        const order = orders.find(o => String(o.id) === String(id) || String(o.order_id) === String(id));
        if (order && order.items) {
          order.items.forEach(element => {
            display = display + element.qty + "x " + element.name + ": " + element.price + "pesos \n";
          });
        }
        alert(display);
      };
    });
  }

  // ======== Prompt for Estimated Delivery Time ========
  async function promptEstimatedDeliveryTime(orderId, isUpdateMode = false) {
    const order = orders.find(o => String(o.id) === String(orderId) || String(o.order_id) === String(orderId));
    if (!order) {
      Swal.fire({
        icon: 'error',
        title: 'Order not found',
        text: 'Could not find the order.'
      });
      return;
    }

    // Check if it's a Delivery order
    if (order.type !== 'Delivery' && order.order_type !== 'Delivery') {
      // For non-delivery orders, just update status without asking for delivery time
      if (!isUpdateMode) {
        updateStatus(orderId, 'Out for Delivery');
      }
      return;
    }

    // Get current date/time and set default
    const now = new Date();
    let defaultDate;
    
    if (isUpdateMode && order.estimated_delivery_datetime) {
      // If updating and there's an existing estimated time, use it
      defaultDate = new Date(order.estimated_delivery_datetime);
    } else {
      // Otherwise default to 24 hours from now
      defaultDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatDateTimeLocal = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const { value: formValues } = await Swal.fire({
      title: isUpdateMode ? 'Update Estimated Delivery Time' : 'Set Estimated Delivery Time',
      html: `
        <div style="text-align: left; padding: 10px;">
          <label for="swal-delivery-date" style="display: block; margin-bottom: 8px; font-weight: 600;">Estimated Delivery Date & Time:</label>
          <input 
            id="swal-delivery-date" 
            type="datetime-local" 
            class="swal2-input" 
            value="${formatDateTimeLocal(defaultDate)}"
            min="${formatDateTimeLocal(now)}"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
          />
          <small style="display: block; margin-top: 5px; color: #666;">When should the customer expect delivery?</small>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: isUpdateMode ? 'Update Delivery Time' : 'Mark as Out for Delivery',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#0066CC',
      cancelButtonColor: '#6c757d',
      preConfirm: () => {
        const dateTimeInput = document.getElementById('swal-delivery-date');
        if (!dateTimeInput || !dateTimeInput.value) {
          Swal.showValidationMessage('Please select an estimated delivery date and time');
          return false;
        }
        
        // Convert datetime-local to ISO format for backend
        const selectedDateTime = new Date(dateTimeInput.value);
        if (selectedDateTime <= now) {
          Swal.showValidationMessage('Estimated delivery time must be in the future');
          return false;
        }
        
        return dateTimeInput.value; // Return datetime-local format, we'll convert it
      }
    });

    if (formValues) {
      // Convert datetime-local to ISO format for backend
      const selectedDateTime = new Date(formValues);
      const isoDateTime = selectedDateTime.toISOString();
      
      if (isUpdateMode) {
        // Update only the estimated delivery time without changing status
        await updateEstimatedDeliveryTime(orderId, isoDateTime);
      } else {
        // Update status with estimated delivery time
        await updateStatus(orderId, 'Out for Delivery', null, isoDateTime);
      }
    }
  }

  // ======== Update Estimated Delivery Time Only ========
  async function updateEstimatedDeliveryTime(orderId, estimated_delivery_datetime) {
    try {
      const resp = await fetch(window.getApiUrl(`api/orders/${orderId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'Out for Delivery', // Keep same status
          estimated_delivery_datetime: estimated_delivery_datetime
        })
      });

      if (!resp.ok) {
        const result = await resp.json().catch(() => ({}));
        throw new Error(result.message || 'Failed to update estimated delivery time');
      }

      // Refresh orders
      orders = await getOrdersAPI() || [];
      await renderOrders();

      Swal.fire({
        icon: 'success',
        title: 'Updated',
        text: 'Estimated delivery time has been updated.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Error updating estimated delivery time:', err);
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: err.message || 'Could not update estimated delivery time.'
      });
    }
  }

  // ======== Accept / Reject Logic ========
  async function updateStatus(id, newStatus, reason = null, estimated_delivery_datetime = null) {
    // Find order by id or order_id (handle both formats)
    let order = orders.find(o => String(o.id) === String(id) || String(o.order_id) === String(id));
    if (!order) {
      console.error('Order not found:', id, 'Available orders:', orders.map(o => ({ id: o.id, order_id: o.order_id })));
      Swal.fire({
        icon: 'error',
        title: 'Order not found',
        text: 'Could not find the order to update.'
      });
      return;
    }

    // Get order_id (prefer order_id, fallback to id)
    const orderId = order.order_id || order.id;

    // Update status locally first
    order.status = newStatus;
    if (reason) {
      console.log('is with reason');
      order.reason = reason;
    }

    try {
      // Use new order management endpoints
      let resp;
      if (newStatus === 'Accepted') {
        // Use the new accept endpoint (changes to "In Process")
        resp = await fetch(window.getApiUrl(`api/orders/${orderId}/accept`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (newStatus === 'Rejected' || newStatus === 'Cancelled') {
        // Use the cancel endpoint (pass status to distinguish between Rejected and Cancelled)
        resp = await fetch(window.getApiUrl(`api/orders/${orderId}/cancel`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            reason: reason || '',
            status: newStatus // Pass the status so backend knows if it's Rejected or Cancelled
          })
        });
      } else {
        // Use the status update endpoint for other statuses (Out for Delivery, Delivered, etc.)
        const requestBody = { status: newStatus };
        if (estimated_delivery_datetime) {
          requestBody.estimated_delivery_datetime = estimated_delivery_datetime;
        }
        resp = await fetch(window.getApiUrl(`api/orders/${orderId}/status`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
      }

      // Handle response - parse JSON once
      let result;
      try {
        const responseText = await resp.text();
        if (!responseText) {
          // Empty response - assume success if status is ok
          result = { success: true, message: 'Order status updated successfully' };
        } else {
          result = JSON.parse(responseText);
        }
      } catch (parseError) {
        // If JSON parsing fails but status is ok, assume success
        if (resp.ok) {
          result = { success: true, message: 'Order status updated successfully' };
        } else {
          throw new Error(`HTTP ${resp.status}: Failed to update order status`);
        }
      }

      // Check if response status indicates error
      if (!resp.ok) {
        throw new Error(result.message || result.error || `HTTP ${resp.status}: Failed to update order status`);
      }
      
      // Check if result indicates failure (some endpoints return {success: false})
      if (result.success === false) {
        throw new Error(result.message || 'Failed to update order status');
      }
      
      console.log('✅ Order status updated in backend:', result);

      if (newStatus === "Accepted") {
        // Prepare payload for email
        const emailPayload = {
          sales: {
            id: order.id || order.order_id,
            customer: order.customer || 'Guest',
            payment: order.payment || 'Cash On Delivery',
            type: order.type || 'Delivery',
            address: order.type === 'Pickup' ? '-' : (order.address || '-'),
            status: 'Accepted',
            items: Array.isArray(order.items) ? order.items : [],
            total: Number(order.total) || 0,
            trnumber: order.trnumber
          },
          email: order.createdbyuser
        };

        console.log("Calling send email", emailPayload);

        try {
          const resp1 = await fetch(window.getApiUrl('send-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
          });
          console.log('Email sent:', await resp1.json().catch(() => ({})));
        } catch (emailErr) {
          console.error('Email sending failed:', emailErr);
        }
      }

      // Refresh orders from API
      orders = await getOrdersAPI() || [];

      // Notify Admin to refresh dashboard
      productUpdateChannel.postMessage({ action: 'refresh' });
      console.log('🔔 Notified admin to refresh dashboard');

      // Re-render: update tab counts and refresh the orders display
      await updateTabCounts(orders);
      await renderOrders(); // This re-renders all tabs properly
      
      console.log('✅ UI refreshed after status update');

      // SweetAlert confirmation
      let statusDisplay = newStatus.toLowerCase();
      let iconType = 'success';
      
      if (newStatus === 'Accepted' || newStatus === 'In Process') {
        statusDisplay = 'accepted';
        iconType = 'success';
      } else if (newStatus === 'Out for Delivery') {
        statusDisplay = 'marked as out for delivery';
        iconType = 'info';
      } else if (newStatus === 'Delivered') {
        statusDisplay = 'marked as delivered';
        iconType = 'success';
      } else if (newStatus === 'Rejected' || newStatus === 'Cancelled') {
        iconType = 'error';
      }
      
      Swal.fire({
        icon: iconType,
        title: `${order.customer}'s order has been ${statusDisplay}!`,
        html: reason ? `<small><i>Reason: ${reason}</i></small>` : '',
        timer: 2000,
        showConfirmButton: false
      });

      await renderOrders();
    } catch (err) {
      console.error('❌ Failed during status update:', err);
      Swal.fire({
        icon: 'error',
        title: 'Update failed',
        text: err?.message || 'Could not update order in the server.',
        confirmButtonColor: '#d33'
      });
    }
  }

  // ======== Reject with Reason ========
  function promptRejectReason(id) {
    const order = orders.find(o => o.id == id);
    if (!order) return;

    Swal.fire({
      title: `Reject ${order.customer}'s order?`,
      input: 'text',
      inputLabel: 'Reason for rejection:',
      inputPlaceholder: 'Out of stock, Invalid address, etc.',
      showCancelButton: true,
      confirmButtonText: 'Reject Order',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      inputValidator: value => !value ? 'You must provide a reason!' : null
    }).then(result => {
      if (result.isConfirmed) updateStatus(id, 'Rejected', result.value);
    });
  }

  // ======== Refresh ========
  refreshBtn?.addEventListener('click', async () => {
    Swal.fire({
      icon: 'info',
      title: 'Orders refreshed!',
      timer: 1500,
      showConfirmButton: false
    });
    await renderOrders();
  });

  // ======== Listen for new orders from customer site ========
  const orderChannel = new BroadcastChannel('orders');
  orderChannel.onmessage = async (event) => {
    const { action, order } = event.data || {};
    if (action === 'new-order' && order) {
      if (!orders.some(o => o.id === order.id)) {
        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        await renderOrders();

        Swal.fire({
          icon: 'info',
          title: `New ${order.type} order received!`,
          html: `
            <b>${order.customer}</b> placed an order for ₱${Number(order.total).toFixed(2)}.<br>
            Payment: <b>${order.payment}</b><br>
            ${order.type === 'Delivery' ? `<i>${order.address}</i>` : ''}
          `,
          confirmButtonColor: '#3085d6'
        });
      }
    }
  };

  // ======== Initial Load ========
  setupTabs(); // Setup tab functionality
  await renderOrders(); // Render orders with default filter (all)
}


function initializeLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  // 🔘 Logout button event
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Swal.fire({
        title: 'Logout?',
        text: 'You will be redirected to the login page.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, logout'
      }).then(result => {
        if (result.isConfirmed) {
          localStorage.removeItem('currentUser');
          Swal.fire({
            icon: 'success',
            title: 'Logged out successfully!',
            showConfirmButton: false,
            timer: 1200
          }).then(() => {
            window.location.href = 'Index.html';
          });
        }
      });
      
    });
  }
}
