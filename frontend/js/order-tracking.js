// My Orders JavaScript - Using Real Data
(() => {
  'use strict';

  const ORDERS_KEY = 'orders';
  const STORAGE_KEY = 'groceryItems';

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    // Load products for image mapping
    let products = [];
    try {
      const storedProducts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      products = Array.isArray(storedProducts) ? storedProducts : [];
      
      // Also try to fetch from API
      try {
        const response = await fetch(window.getApiUrl('api/items'));
        if (response.ok) {
          const apiProducts = await response.json();
          if (Array.isArray(apiProducts) && apiProducts.length > 0) {
            // Merge API products with local
            const productMap = new Map();
            products.forEach(p => {
              if (p && p.id != null) productMap.set(String(p.id), p);
            });
            apiProducts.forEach(p => {
              if (p && p.id != null) {
                const existing = productMap.get(String(p.id));
                productMap.set(String(p.id), existing || p);
              }
            });
            products = Array.from(productMap.values());
          }
        }
      } catch (err) {
        console.debug('API fetch failed, using local products:', err);
      }
    } catch (err) {
      console.error('Error loading products:', err);
    }

    // Load orders from localStorage and API
    let allOrders = [];
    let userOrders = [];
    
    // Load from localStorage
    try {
      const localOrders = JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
      if (Array.isArray(localOrders)) {
        allOrders = localOrders;
      }
    } catch (err) {
      console.error('Error loading orders from localStorage:', err);
    }

    // Fetch orders from API using new customer endpoint
    if (currentUser && currentUser.username) {
      try {
        const response = await fetch(window.getApiUrl(`api/orders/customer?username=${encodeURIComponent(currentUser.username)}`));
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.orders)) {
            userOrders = data.orders;
            // Store in allOrders for viewOrderDetails function
            allOrders = data.orders;
          }
        }
      } catch (err) {
        console.debug('API fetch failed, trying fallback:', err);
        // Fallback to old endpoint
        try {
          const response = await fetch(window.getApiUrl('api/sales'));
          if (response.ok) {
            const apiOrders = await response.json();
            if (Array.isArray(apiOrders)) {
              userOrders = apiOrders.filter(order => 
                order && order.createdbyuser === currentUser.username
              );
              // Store in allOrders for viewOrderDetails function
              allOrders = userOrders;
            }
          }
        } catch (err2) {
          console.error('Fallback API fetch failed:', err2);
        }
      }
    } else {
      // If no user logged in, show empty (or could show message to login)
      userOrders = [];
    }

    // Sort orders by date (newest first)
    userOrders.sort((a, b) => {
      const dateA = a.id || a.createdAt || 0;
      const dateB = b.id || b.createdAt || 0;
      return dateB - dateA;
    });

    // Create a set of order IDs for quick lookup
    const userOrderIds = new Set(userOrders.map(order => order.order_id || order.id).filter(Boolean));

    // Categorize orders
    const ongoingOrders = [];
    const completedOrders = [];

    userOrders.forEach(order => {
      const status = (order.status || order.order_status || 'Pending');
      
      // Map status to UI status
      let uiStatus = 'to-ship';
      let uiStatusLabel = 'Pending';

      if (status === 'Pending') {
        uiStatus = 'to-ship';
        uiStatusLabel = 'Pending';
      } else if (status === 'In Process') {
        uiStatus = 'shipping';
        uiStatusLabel = 'In Process';
      } else if (status === 'Ready for Pick up') {
        uiStatus = 'to-receive';
        uiStatusLabel = 'Ready for Pick up';
      } else if (status === 'Out for Delivery') {
        uiStatus = 'to-receive';
        uiStatusLabel = 'Out for Delivery';
      } else if (status === 'Delivered' || status === 'Completed') {
        uiStatus = 'delivered';
        uiStatusLabel = status === 'Completed' ? 'Completed' : 'Delivered';
        completedOrders.push(transformOrder(order, uiStatus, uiStatusLabel, products));
        return;
      } else if (status === 'Cancelled') {
        uiStatus = 'cancelled';
        uiStatusLabel = 'Cancelled';
        completedOrders.push(transformOrder(order, uiStatus, uiStatusLabel, products));
        return;
      } else if (status === 'Rejected') {
        uiStatus = 'rejected';
        uiStatusLabel = 'Rejected';
        completedOrders.push(transformOrder(order, uiStatus, uiStatusLabel, products));
        return;
      } else {
        // Default to ongoing
        ongoingOrders.push(transformOrder(order, uiStatus, uiStatusLabel, products));
        return;
      }

      // Add to ongoing if not completed
      ongoingOrders.push(transformOrder(order, uiStatus, uiStatusLabel, products));
    });

    // Fetch return/refund requests for current user (after orders are categorized)
    let returnRefundRequests = [];
    if (currentUser && currentUser.username) {
      try {
            // Use username parameter to filter on backend
            const response = await fetch(window.getApiUrl(`api/return-refund?username=${encodeURIComponent(currentUser.username)}`));
            if (response.ok) {
              const data = await response.json();
              if (data.success && Array.isArray(data.requests)) {
                // Backend already filtered by username/user_id, so trust it
                // Only do additional filtering if we have specific concerns
                returnRefundRequests = data.requests;
                
                // Optional: Log if any requests don't match user's orders (for debugging)
                if (userOrderIds.size > 0) {
                  const unmatched = returnRefundRequests.filter(r => !userOrderIds.has(r.order_id));
                  if (unmatched.length > 0) {
                    console.warn('⚠️ Some return/refund requests have order IDs not in user orders:', unmatched);
                  }
                }
                
                console.log(`✅ Found ${returnRefundRequests.length} return/refund requests for user ${currentUser.username}`, {
                  totalRequests: data.requests.length,
                  userOrderIds: Array.from(userOrderIds),
                  filteredRequests: returnRefundRequests,
                  requests: returnRefundRequests
                });
              } else {
                console.warn('⚠️ Backend returned invalid data:', data);
                returnRefundRequests = [];
              }
            } else {
              console.error('❌ Failed to fetch return/refund requests:', response.status, response.statusText);
              returnRefundRequests = [];
            }
      } catch (err) {
        console.error('Error fetching return/refund requests:', err);
      }
    }

    // Format date helper function (accessible to all rendering functions)
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        return dateString;
      }
    };

    // Transform order to UI format
    function transformOrder(order, status, statusLabel, products) {
      // Get product images and details
      const items = (order.items || []).map(item => {
        // Find product in products array
        const productId = item.product_id || item.id;
        const product = products.find(p => 
          p && String(p.id) === String(productId)
        );

        return {
          name: item.name || item.product_name || 'Unknown Product',
          variant: product?.category || item.category || '',
          quantity: item.quantity || item.qty || 1,
          price: Number(item.price || 0),
          image: product?.images || item.image || 'https://via.placeholder.com/200?text=Product'
        };
      });

      // Use order_id from API or generate one
      const orderId = order.order_id || order.id || `ORD-${Date.now().toString().slice(-6)}`;

      // Format date
      let orderDate = new Date();
      if (order.order_date) {
        orderDate = new Date(order.order_date);
      } else if (order.orderDate) {
        orderDate = new Date(order.orderDate);
      } else if (order.createddate) {
        orderDate = new Date(order.createddate);
      } else if (order.id && typeof order.id === 'number') {
        orderDate = new Date(order.id);
      }

      return {
        orderId: orderId,
        orderDate: orderDate.toISOString().split('T')[0],
        status: status,
        statusLabel: statusLabel,
        items: items,
        total: Number(order.total || order.total_amount || 0),
        address: order.address || order.shipping_address || '-',
        contact: order.contact || order.contact_number || '-',
        payment: order.payment || order.payment_method || 'Cash On Delivery',
        type: order.type || order.order_type || 'Delivery',
        rawStatus: order.status || order.order_status || 'Pending',
        estimated_delivery_datetime: order.estimated_delivery_datetime || null
      };
    }

    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    const ordersLists = document.querySelectorAll('.orders-list');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');

        // Update active tab
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update active content
        ordersLists.forEach(list => {
          list.classList.remove('active');
          list.style.display = 'none';
        });
        const targetElement = document.getElementById(`${targetTab}-orders`);
        if (targetElement) {
          targetElement.classList.add('active');
          targetElement.style.display = 'block';
          console.log(`✅ Activated ${targetTab} tab, element:`, targetElement);
        } else {
          console.error(`❌ Target element not found: ${targetTab}-orders`);
        }

        // Load orders for the active tab
        if (targetTab === 'ongoing') {
          renderOrders(ongoingOrders, 'ongoing-orders-list', 'ongoing-empty');
        } else if (targetTab === 'completed') {
          renderOrders(completedOrders, 'completed-orders-list', 'completed-empty');
        } else if (targetTab === 'return-refund') {
          console.log('🔄 Tab clicked: return-refund, calling renderReturnRefundRequests');
          console.log('📊 Current returnRefundRequests:', returnRefundRequests);
          // Re-fetch if array is empty or undefined
          if (!returnRefundRequests || returnRefundRequests.length === 0) {
            console.log('⚠️ returnRefundRequests is empty, re-fetching...');
            // Re-fetch return/refund requests
            if (currentUser && currentUser.username) {
              fetch(window.getApiUrl(`api/return-refund?username=${encodeURIComponent(currentUser.username)}`))
                .then(response => {
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }
                  return response.json();
                })
                .then(data => {
                  if (data.success && Array.isArray(data.requests)) {
                    // Trust backend filtering
                    returnRefundRequests = data.requests;
                    console.log('✅ Re-fetched return/refund requests:', returnRefundRequests.length, returnRefundRequests);
                    renderReturnRefundRequests().catch(err => {
                      console.error('❌ Error rendering return/refund requests:', err);
                    });
                  } else {
                    console.warn('⚠️ Backend returned invalid data on re-fetch:', data);
                    returnRefundRequests = [];
                    renderReturnRefundRequests().catch(err => {
                      console.error('❌ Error rendering return/refund requests:', err);
                    });
                  }
                })
                .catch(err => {
                  console.error('❌ Error re-fetching return/refund requests:', err);
                  returnRefundRequests = [];
                  renderReturnRefundRequests().catch(err => {
                    console.error('❌ Error rendering return/refund requests:', err);
                  });
                });
            } else {
              console.warn('⚠️ No current user, cannot re-fetch');
              renderReturnRefundRequests().catch(err => {
                console.error('❌ Error rendering return/refund requests:', err);
              });
            }
          } else {
            renderReturnRefundRequests().catch(err => {
              console.error('❌ Error rendering return/refund requests:', err);
            });
          }
        }
      });
    });

    // Render orders function
    function renderOrders(orders, listId, emptyId) {
      const ordersList = document.getElementById(listId);
      const emptyState = document.getElementById(emptyId);

      if (!ordersList || !emptyState) return;

      // Clear existing content
      ordersList.innerHTML = '';

      if (orders.length === 0) {
        ordersList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      ordersList.style.display = 'block';
      emptyState.style.display = 'none';

      // Render each order
      orders.forEach(order => {
        const orderCard = createOrderCard(order);
        ordersList.appendChild(orderCard);
      });
    }

    // Create order card HTML
    function createOrderCard(order) {
      const card = document.createElement('div');
      card.className = 'order-card';

      // formatDate is now defined at top level, accessible here

      // Build items HTML
      const itemsHTML = order.items.map(item => `
        <div class="order-item">
          <img src="${item.image}" alt="${item.name}" class="item-image" onerror="this.src='https://via.placeholder.com/200?text=Product'">
          <div class="item-details">
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${item.variant ? `<div class="item-variant">${escapeHtml(item.variant)}</div>` : ''}
            <div class="item-quantity">Quantity: ${item.quantity}</div>
            <div class="item-price">₱${item.price.toFixed(2)}</div>
          </div>
        </div>
      `).join('');

      // Show "Order Received" button if status is "Out for Delivery"
      const showReceivedBtn = order.rawStatus === 'Out for Delivery';
      // Show "Cancel" button if status is "Pending" (customer can cancel)
      const showCancelBtn = order.rawStatus === 'Pending';
      // Show "Return/Refund" button if status is "Completed" or "Delivered"
      const showReturnRefundBtn = order.rawStatus === 'Completed' || order.rawStatus === 'Delivered';
      
      // Format estimated delivery time if available
      let estimatedDeliveryHTML = '';
      if (order.estimated_delivery_datetime && order.type === 'Delivery') {
        try {
          const deliveryDate = new Date(order.estimated_delivery_datetime);
          const formattedDate = deliveryDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          const formattedTime = deliveryDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          });
          estimatedDeliveryHTML = `
            <div class="order-delivery-info" style="margin-top: 8px; padding: 8px 12px; background: #E6F2FF; border-radius: 6px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-truck" style="color: #0066CC;"></i>
              <span style="font-size: 13px; color: #1A1A1A;">
                <strong>Estimated delivery:</strong> ${formattedDate} at ${formattedTime}
              </span>
            </div>
          `;
        } catch (e) {
          console.error('Error formatting estimated delivery time:', e);
        }
      }
      
      card.innerHTML = `
        <div class="order-header">
          <div class="order-info">
            <div class="order-id">Order ID: ${order.orderId}</div>
            <div class="order-date">${formatDate(order.orderDate)}</div>
            ${estimatedDeliveryHTML}
          </div>
          <span class="order-status-badge status-${order.status}">${order.statusLabel}</span>
        </div>
        <div class="order-items">
          ${itemsHTML}
        </div>
        <div class="order-footer">
          <div class="order-total">
            <span class="total-label">Total:</span>
            <span class="total-amount">₱${order.total.toFixed(2)}</span>
          </div>
          <div class="order-actions">
            ${showCancelBtn ? `
              <button class="order-cancel-btn" onclick="cancelOrder('${order.orderId}')">
                <i class="fas fa-times"></i> Cancel Order
              </button>
            ` : ''}
            ${showReceivedBtn ? `
              <button class="order-received-btn" onclick="markOrderReceived('${order.orderId}')">
                <i class="fas fa-check"></i> Order Received
              </button>
            ` : ''}
            ${showReturnRefundBtn ? `
              <button class="order-return-refund-btn" onclick="openReturnRefundModal('${order.orderId}')">
                <i class="fas fa-undo"></i> Return/Refund
              </button>
            ` : ''}
            <button class="view-details-btn" onclick="viewOrderDetails('${order.orderId}')">
              View Details
            </button>
          </div>
        </div>
      `;

      return card;
    }

    // Escape HTML function
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Update tab counts
    function updateTabCounts() {
      const ongoingCount = document.getElementById('ongoing-count');
      const completedCount = document.getElementById('completed-count');
      const returnRefundCount = document.getElementById('return-refund-count');

      if (ongoingCount) {
        ongoingCount.textContent = ongoingOrders.length;
      }
      if (completedCount) {
        completedCount.textContent = completedOrders.length;
      }
      if (returnRefundCount) {
        returnRefundCount.textContent = returnRefundRequests.length;
      }
    }

    // Render return/refund requests
    async function renderReturnRefundRequests() {
      const container = document.getElementById('return-refund-orders-list');
      const emptyState = document.getElementById('return-refund-empty');
      const parentSection = document.getElementById('return-refund-orders');

      if (!container) {
        console.error('❌ Return/refund container not found!');
        return;
      }

      console.log('🔄 Rendering return/refund requests:', {
        count: returnRefundRequests.length,
        requests: returnRefundRequests,
        container: container,
        parentSection: parentSection
      });

      // Ensure parent section is visible
      if (parentSection) {
        parentSection.style.display = 'block';
        parentSection.classList.add('active');
      }

      container.innerHTML = '';

      if (returnRefundRequests.length === 0) {
        console.log('⚠️ No return/refund requests to display');
        if (emptyState) {
          emptyState.style.display = 'block';
          console.log('✅ Showing empty state');
        }
        if (container) container.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
      }

      // Get orders for these requests to display order details
      const orderMap = new Map();
      userOrders.forEach(order => {
        const orderId = order.order_id || order.id;
        if (orderId) orderMap.set(orderId, order);
      });

      console.log('📦 Order map created with', orderMap.size, 'orders');

      // Fetch order items for requests that don't have items in the order map
      let cardsCreated = 0;
      for (const request of returnRefundRequests) {
        try {
          let order = orderMap.get(request.order_id);
          
          console.log(`Processing request ${request.id} for order ${request.order_id}:`, {
            hasOrder: !!order,
            request: request
          });
          
          // If order not found in map, try to fetch it from API
          if (!order && request.order_id && currentUser && currentUser.username) {
            try {
              const orderResponse = await fetch(window.getApiUrl(`api/orders/customer?username=${encodeURIComponent(currentUser.username)}`));
              if (orderResponse.ok) {
                const orderData = await orderResponse.json();
                if (orderData.success && Array.isArray(orderData.orders)) {
                  order = orderData.orders.find(o => o.order_id === request.order_id);
                  if (order) {
                    orderMap.set(request.order_id, order);
                    console.log(`✅ Found order ${request.order_id} from API`);
                  }
                }
              }
            } catch (err) {
              console.debug('Could not fetch order details for return/refund request:', err);
            }
          }
          
          const card = createReturnRefundCard(request, order, products);
          if (card) {
            container.appendChild(card);
            cardsCreated++;
            console.log(`✅ Added card ${cardsCreated} for request ${request.order_id}`);
          } else {
            console.error('❌ Failed to create card for request:', request.order_id);
          }
        } catch (err) {
          console.error('❌ Error rendering request card:', err, request);
        }
      }
      
      console.log(`✅ Finished rendering ${cardsCreated} return/refund request cards. Container has ${container.children.length} children.`);
      
      // Force a reflow to ensure visibility
      if (container.children.length > 0) {
        container.offsetHeight; // Trigger reflow
      }
    }

    // Create return/refund request card
    function createReturnRefundCard(request, order, products) {
      const card = document.createElement('div');
      card.className = 'order-card';

      // Get order items if available
      let itemsHTML = '';
      if (order && order.items && Array.isArray(order.items)) {
        itemsHTML = order.items.map(item => `
          <div class="order-item">
            <div class="item-image">
              ${getProductImage(item.product_id || item.id, products)}
            </div>
            <div class="item-details">
              <div class="item-name">${escapeHtml(item.name || item.product_name || 'Unknown Product')}</div>
              <div class="item-quantity">Quantity: ${item.quantity || item.qty || 0}</div>
              <div class="item-price">₱${(item.price || 0).toFixed(2)}</div>
            </div>
          </div>
        `).join('');
      } else {
        itemsHTML = '<div class="text-muted">Order details not available</div>';
      }

      // Status badge
      let statusBadge = '';
      let statusClass = '';
      switch (request.status) {
        case 'Pending':
          statusBadge = 'Pending Review';
          statusClass = 'status-pending';
          break;
        case 'Approved':
          statusBadge = 'Approved';
          statusClass = 'status-approved';
          break;
        case 'Returned':
          statusBadge = 'Returned';
          statusClass = 'status-returned';
          break;
        case 'Refunded':
          statusBadge = 'Refunded';
          statusClass = 'status-refunded';
          break;
        case 'Rejected':
          statusBadge = 'Rejected';
          statusClass = 'status-rejected';
          break;
        default:
          statusBadge = request.status;
          statusClass = 'status-unknown';
      }

      // Image preview
      let imagePreview = '';
      if (request.image_path) {
        const imageUrl = `${window.API_BASE_URL}/${request.image_path}`;
        imagePreview = `
          <div class="mb-2">
            <a href="${imageUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
              <i class="fas fa-image"></i> View Image
            </a>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="order-header">
          <div class="order-info">
            <div class="order-id">Order ID: ${request.order_id}</div>
            <div class="order-date">Requested: ${formatDate(request.created_at)}</div>
          </div>
          <span class="order-status-badge ${statusClass}">${statusBadge}</span>
        </div>
        <div class="order-items">
          ${itemsHTML}
        </div>
        <div class="order-footer">
          <div class="order-total">
            <span class="total-label">Request Type:</span>
            <span class="total-amount">${request.request_type || 'Return'}</span>
          </div>
          <div class="order-total">
            <span class="total-label">Amount:</span>
            <span class="total-amount">₱${Number(request.total_amount || 0).toFixed(2)}</span>
          </div>
        </div>
        <div class="return-refund-details" style="padding: 15px; background: #f8f9fa; border-top: 1px solid #dee2e6;">
          <div class="mb-2">
            <strong>Reason:</strong>
            <p style="margin: 5px 0 0 0; color: #495057;">${escapeHtml(request.reason)}</p>
          </div>
          ${imagePreview}
          ${request.admin_notes ? `
            <div class="mt-2">
              <strong>Admin Notes:</strong>
              <p style="margin: 5px 0 0 0; color: #6c757d; font-style: italic;">${escapeHtml(request.admin_notes)}</p>
            </div>
          ` : ''}
        </div>
      `;

      return card;
    }

    function getProductImage(productId, products) {
      if (!productId || !products || !Array.isArray(products)) {
        return '<div class="item-image-placeholder"><i class="fas fa-image"></i></div>';
      }
      
      const product = products.find(p => p && String(p.id) === String(productId));
      if (product && product.images) {
        const imageUrl = product.images.startsWith('http') 
          ? product.images 
          : `${window.API_BASE_URL}/${product.images}`;
        return `<img src="${imageUrl}" alt="${escapeHtml(product.names || 'Product')}" onerror="this.parentElement.innerHTML='<div class=\\'item-image-placeholder\\'><i class=\\'fas fa-image\\'></i></div>'">`;
      }
      
      return '<div class="item-image-placeholder"><i class="fas fa-image"></i></div>';
    }

    // Mark order as received
    window.markOrderReceived = async function(orderId) {
      try {
        const response = await fetch(window.getApiUrl(`api/orders/${orderId}/received`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });

        // Handle response - parse JSON once
        let data;
        try {
          const responseText = await response.text();
          if (!responseText) {
            // Empty response - assume success if status is ok
            data = { success: true, message: 'Order marked as received' };
          } else {
            data = JSON.parse(responseText);
          }
        } catch (parseError) {
          // If JSON parsing fails but status is ok, assume success
          if (response.ok) {
            data = { success: true, message: 'Order marked as received' };
          } else {
            throw new Error(`HTTP ${response.status}: Failed to mark order as received`);
          }
        }

        // Check if response status indicates error
        if (!response.ok) {
          throw new Error(data.message || data.error || `HTTP ${response.status}: Failed to mark order as received`);
        }
        
        // Check if result indicates failure
        if (data.success === false) {
          throw new Error(data.message || 'Failed to mark order as received');
        }
        
        // Success - show confirmation
        if (window.Swal && typeof Swal.fire === 'function') {
          Swal.fire({
            icon: 'success',
            title: 'Order Received',
            text: 'Your order has been marked as received.',
            timer: 2000,
            showConfirmButton: false
          }).then(() => {
            // Reload orders after showing success message
            window.location.reload();
          });
        } else {
          alert('Order marked as received!');
          window.location.reload();
        }
      } catch (error) {
        console.error('Error marking order as received:', error);
        if (window.Swal && typeof Swal.fire === 'function') {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to mark order as received'
          });
        } else {
          alert('Error: ' + (error.message || 'Failed to mark order as received'));
        }
      }
    };

    // Cancel order (customer can cancel "In Process" orders)
    window.cancelOrder = async function(orderId) {
      if (!window.Swal || typeof Swal.fire !== 'function') {
        const reason = prompt('Please provide a reason for cancellation:');
        if (!reason || !reason.trim()) {
          alert('Cancellation reason is required.');
          return;
        }
        await performCancel(orderId, reason.trim());
        return;
      }

      Swal.fire({
        title: 'Cancel Order?',
        html: `
          <p>Are you sure you want to cancel this order?</p>
          <p><strong>Order ID: ${orderId}</strong></p>
        `,
        input: 'textarea',
        inputLabel: 'Reason for cancellation:',
        inputPlaceholder: 'Please provide a reason (e.g., Changed my mind, Found better price, etc.)',
        inputAttributes: {
          'aria-label': 'Reason for cancellation'
        },
        showCancelButton: true,
        confirmButtonText: 'Yes, Cancel Order',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return 'You must provide a reason for cancellation!';
          }
          if (value.trim().length < 5) {
            return 'Please provide a more detailed reason (at least 5 characters).';
          }
        }
      }).then(async (result) => {
        if (result.isConfirmed) {
          await performCancel(orderId, result.value.trim());
        }
      });
    };

    async function performCancel(orderId, reason) {
      try {
        const response = await fetch(window.getApiUrl(`api/orders/${orderId}/cancel-customer`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason })
        });

        // Handle response - parse JSON once
        let data;
        try {
          const responseText = await response.text();
          if (!responseText) {
            data = { success: true, message: 'Order cancelled successfully' };
          } else {
            data = JSON.parse(responseText);
          }
        } catch (parseError) {
          if (response.ok) {
            data = { success: true, message: 'Order cancelled successfully' };
          } else {
            throw new Error(`HTTP ${response.status}: Failed to cancel order`);
          }
        }

        // Check if response status indicates error
        if (!response.ok) {
          throw new Error(data.message || data.error || `HTTP ${response.status}: Failed to cancel order`);
        }
        
        // Check if result indicates failure
        if (data.success === false) {
          throw new Error(data.message || 'Failed to cancel order');
        }
        
        // Success - show confirmation with special message for GCash
        if (window.Swal && typeof Swal.fire === 'function') {
          if (data.isGCash) {
            // Special modal for GCash cancellations
            Swal.fire({
              icon: 'info',
              title: 'Order Cancelled',
              html: `
                <p>Your order has been cancelled successfully.</p>
                <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #2196F3;">
                  <p style="margin: 0; font-weight: 600; color: #1976D2;">💰 GCash Refund Information</p>
                  <p style="margin: 10px 0 0 0; color: #424242;">
                    Your refund request has been submitted. The payment will be refunded to your GCash account within <strong>24-48 hours</strong>.
                  </p>
                  <p style="margin: 10px 0 0 0; color: #757575; font-size: 0.9em;">
                    You can track the refund status in the <strong>Return/Refund</strong> tab.
                  </p>
                </div>
              `,
              confirmButtonText: 'OK',
              confirmButtonColor: '#2196F3',
              width: '600px'
            }).then(() => {
              // Reload orders after showing success message
              window.location.reload();
            });
          } else {
            Swal.fire({
              icon: 'success',
              title: 'Order Cancelled',
              text: 'Your order has been cancelled successfully.',
              timer: 2000,
              showConfirmButton: false
            }).then(() => {
              // Reload orders after showing success message
              window.location.reload();
            });
          }
        } else {
          if (data.isGCash) {
            alert('Order cancelled successfully! Your GCash payment will be refunded within 24-48 hours.');
          } else {
            alert('Order cancelled successfully!');
          }
          window.location.reload();
        }
      } catch (error) {
        console.error('Error cancelling order:', error);
        if (window.Swal && typeof Swal.fire === 'function') {
          Swal.fire({
            icon: 'error',
            title: 'Cancellation Failed',
            text: error.message || 'Failed to cancel order. Please try again.'
          });
        } else {
          alert('Error: ' + (error.message || 'Failed to cancel order'));
        }
      }
    }

    // View order details
    window.viewOrderDetails = function(orderId) {
      // Find the order in all orders
      const order = allOrders.find(o => 
        (o.order_id || o.id) === orderId
      );
      
      if (!order) {
        Swal.fire({
          icon: 'error',
          title: 'Order Not Found',
          text: 'Could not find order details.'
        });
        return;
      }

      // Transform order to UI format
      const uiOrder = transformOrder(order, order.status || order.order_status || 'Pending', 
        order.status || order.order_status || 'Pending', products);

      // Format order date
      const orderDate = new Date(uiOrder.orderDate);
      const formattedOrderDate = orderDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      // Format estimated delivery time if available
      let estimatedDeliveryHTML = '';
      
      // Check both uiOrder and original order for estimated_delivery_datetime
      // Also check for different possible field names
      const estimatedDelivery = uiOrder.estimated_delivery_datetime || 
                                order.estimated_delivery_datetime || 
                                order.estimated_delivery_time ||
                                null;
      
      if (estimatedDelivery && uiOrder.type === 'Delivery') {
        try {
          const deliveryDate = new Date(estimatedDelivery);
          
          if (!isNaN(deliveryDate.getTime())) {
            const formattedDeliveryDate = deliveryDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            const formattedDeliveryTime = deliveryDate.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
            estimatedDeliveryHTML = `
              <div style="margin-top: 12px; padding: 12px; background: #E6F2FF; border-radius: 8px; border-left: 4px solid #0066CC;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <i class="fas fa-truck" style="color: #0066CC; font-size: 16px;"></i>
                  <strong style="color: #1A1A1A;">Estimated Delivery Time</strong>
                </div>
                <div style="color: #4A5568; font-size: 14px; margin-left: 24px;">
                  ${formattedDeliveryDate} at ${formattedDeliveryTime}
                </div>
              </div>
            `;
          }
        } catch (e) {
          console.error('Error formatting estimated delivery time:', e, estimatedDelivery);
        }
      }

      // Build items list HTML
      const itemsListHTML = uiOrder.items.map((item, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #E5E5E5;">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #1A1A1A; margin-bottom: 4px;">${index + 1}. ${escapeHtml(item.name)}</div>
            ${item.variant ? `<div style="font-size: 12px; color: #718096; margin-bottom: 4px;">${escapeHtml(item.variant)}</div>` : ''}
            <div style="font-size: 13px; color: #4A5568;">Quantity: ${item.quantity} × ₱${item.price.toFixed(2)}</div>
          </div>
          <div style="font-weight: 700; color: #0066CC; font-size: 16px; margin-left: 16px;">
            ₱${(item.price * item.quantity).toFixed(2)}
          </div>
        </div>
      `).join('');

      // Status badge color
      let statusColor = '#0066CC';
      let statusBg = '#E6F2FF';
      switch (uiOrder.rawStatus) {
        case 'Pending':
          statusColor = '#F57C00';
          statusBg = '#FFF3E0';
          break;
        case 'In Process':
        case 'Accepted':
          statusColor = '#1976D2';
          statusBg = '#E3F2FD';
          break;
        case 'Out for Delivery':
          statusColor = '#0288D1';
          statusBg = '#E1F5FE';
          break;
        case 'Delivered':
        case 'Completed':
          statusColor = '#28a745';
          statusBg = '#E8F5E9';
          break;
        case 'Cancelled':
        case 'Rejected':
          statusColor = '#dc3545';
          statusBg = '#fee2e2';
          break;
      }

      Swal.fire({
        title: `<div style="text-align: left; padding-bottom: 12px; border-bottom: 2px solid #D1E0FF;">
          <div style="font-size: 20px; font-weight: 700; color: #1A1A1A; margin-bottom: 8px;">Order Details</div>
          <div style="font-size: 14px; color: #4A5568;">Order ID: <strong style="color: #0066CC;">${uiOrder.orderId}</strong></div>
        </div>`,
        html: `
          <div style="text-align: left; max-height: 60vh; overflow-y: auto;">
            <!-- Order Status -->
            <div style="margin-bottom: 16px;">
              <div style="display: inline-block; padding: 6px 12px; border-radius: 6px; background: ${statusBg}; color: ${statusColor}; font-weight: 600; font-size: 13px;">
                ${uiOrder.statusLabel}
              </div>
            </div>

            <!-- Order Information -->
            <div style="margin-bottom: 16px;">
              <div style="font-weight: 600; color: #1A1A1A; margin-bottom: 8px; font-size: 14px;">Order Information</div>
              <div style="background: #F5F9FF; padding: 12px; border-radius: 6px; font-size: 13px;">
                <div style="margin-bottom: 6px;"><strong>Order Date:</strong> <span style="color: #4A5568;">${formattedOrderDate}</span></div>
                <div style="margin-bottom: 6px;"><strong>Order Type:</strong> <span style="color: #4A5568;">${uiOrder.type}</span></div>
                <div style="margin-bottom: 6px;"><strong>Payment Method:</strong> <span style="color: #4A5568;">${uiOrder.payment}</span></div>
                ${uiOrder.contact && uiOrder.contact !== '-' ? `<div style="margin-bottom: 6px;"><strong>Contact Number:</strong> <span style="color: #4A5568;">${uiOrder.contact}</span></div>` : ''}
                ${uiOrder.type === 'Delivery' && uiOrder.address && uiOrder.address !== '-' ? `
                  <div style="margin-bottom: 6px;"><strong>Delivery Address:</strong> <span style="color: #4A5568;">${escapeHtml(uiOrder.address)}</span></div>
                ` : ''}
              </div>
            </div>

            <!-- Estimated Delivery Time -->
            ${estimatedDeliveryHTML}

            <!-- Order Items -->
            <div style="margin-top: 16px;">
              <div style="font-weight: 600; color: #1A1A1A; margin-bottom: 8px; font-size: 14px;">Order Items (${uiOrder.items.length})</div>
              <div style="background: #FFFFFF; border: 1px solid #D1E0FF; border-radius: 6px; overflow: hidden;">
                ${itemsListHTML}
              </div>
            </div>

            <!-- Total -->
            <div style="margin-top: 16px; padding: 16px; background: #F5F9FF; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #0066CC;">
              <div style="font-weight: 700; color: #1A1A1A; font-size: 18px;">Total Amount:</div>
              <div style="font-weight: 700; color: #0066CC; font-size: 24px;">₱${uiOrder.total.toFixed(2)}</div>
            </div>
          </div>
        `,
        width: '600px',
        showCloseButton: true,
        showConfirmButton: true,
        confirmButtonText: 'Close',
        confirmButtonColor: '#0066CC',
        customClass: {
          popup: 'order-details-modal'
        }
      });
    };

    // Open Return/Refund Modal
    window.openReturnRefundModal = function(orderId) {
      document.getElementById('return-refund-order-id').value = orderId;
      document.getElementById('return-refund-reason').value = '';
      document.getElementById('return-refund-image').value = '';
      document.getElementById('return-refund-type').value = 'Return';
      
      const modal = new bootstrap.Modal(document.getElementById('returnRefundModal'));
      modal.show();
    };

    // Handle Return/Refund Form Submission
    document.getElementById('returnRefundForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const orderId = document.getElementById('return-refund-order-id').value;
      const reason = document.getElementById('return-refund-reason').value.trim();
      const requestType = document.getElementById('return-refund-type').value;
      const imageFile = document.getElementById('return-refund-image').files[0];

      if (!reason) {
        if (window.Swal && typeof Swal.fire === 'function') {
          Swal.fire({
            icon: 'warning',
            title: 'Reason Required',
            text: 'Please provide a reason for your return/refund request.'
          });
        } else {
          alert('Please provide a reason for your return/refund request.');
        }
        return;
      }

      try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('order_id', orderId);
        formData.append('reason', reason);
        formData.append('request_type', requestType);
        if (imageFile) {
          formData.append('image', imageFile);
        }

        const response = await fetch(window.getApiUrl('api/return-refund'), {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(data.message || 'Failed to submit return/refund request');
        }

        // Success
        const modal = bootstrap.Modal.getInstance(document.getElementById('returnRefundModal'));
        modal.hide();

        if (window.Swal && typeof Swal.fire === 'function') {
          Swal.fire({
            icon: 'success',
            title: 'Request Submitted',
            text: 'Your return/refund request has been submitted successfully. We will review it shortly.',
            timer: 3000,
            showConfirmButton: false
          }).then(() => {
            window.location.reload();
          });
        } else {
          alert('Return/Refund request submitted successfully!');
          window.location.reload();
        }
      } catch (error) {
        console.error('Error submitting return/refund request:', error);
        if (window.Swal && typeof Swal.fire === 'function') {
          Swal.fire({
            icon: 'error',
            title: 'Submission Failed',
            text: error.message || 'Failed to submit return/refund request. Please try again.'
          });
        } else {
          alert('Error: ' + (error.message || 'Failed to submit return/refund request'));
        }
      }
    });

    // Initialize: Load ongoing orders by default
    renderOrders(ongoingOrders, 'ongoing-orders-list', 'ongoing-empty');
    updateTabCounts();
    
    // Don't pre-render return/refund requests on initial load
    // They will render when the Return/Refund tab is clicked
    // renderReturnRefundRequests();

    // Add logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
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

        // Clear user and redirect
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
      });
    }

    // Listen for new orders via BroadcastChannel
    const orderChannel = new BroadcastChannel('orders');
    orderChannel.onmessage = (event) => {
      const { action, order } = event.data;
      if (action === 'new-order' && order) {
        // Reload orders when a new order is received
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };
  });
})();
