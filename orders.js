const refreshOrdersButton = document.querySelector('#refresh-orders');
const ordersSearch = document.querySelector('#orders-search');
const ordersBody = document.querySelector('#orders-body');
const ordersMessage = document.querySelector('#orders-message');
const authCard = document.querySelector('#auth-card');
const totalOrders = document.querySelector('#total-orders');
const totalSales = document.querySelector('#total-sales');
const averageOrder = document.querySelector('#average-order');

let allOrders = [];

function formatMoney(value, currency = 'PLN') {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showMessage(message, type = 'info') {
  ordersMessage.textContent = message;
  ordersMessage.classList.toggle('error', type === 'error');
  ordersMessage.classList.remove('hidden');
}

function clearMessage() {
  ordersMessage.textContent = '';
  ordersMessage.classList.remove('error');
  ordersMessage.classList.add('hidden');
}

function setAuthState(isVisible) {
  authCard.classList.toggle('hidden', !isVisible);
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getOrders(data) {
  if (Array.isArray(data?.checkoutForms)) {
    return data.checkoutForms;
  }

  if (Array.isArray(data?.orders)) {
    return data.orders;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

function getPaidAmount(order) {
  return order?.payment?.paidAmount || order?.summary?.totalToPay || order?.summary?.totalPaid || {};
}

function getPaymentDate(order) {
  return order?.payment?.finishedAt || order?.payment?.startedAt || order?.boughtAt || order?.createdAt || order?.updatedAt;
}

function getBuyerName(order) {
  const firstName = order?.buyer?.firstName || order?.buyer?.name || '';
  const lastName = order?.buyer?.lastName || '';
  return [firstName, lastName].filter(Boolean).join(' ') || '-';
}

function getItemsCount(order) {
  const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];

  return lineItems.reduce((sum, item) => {
    const quantity = Number(item?.quantity || 1);
    return sum + (Number.isFinite(quantity) ? quantity : 1);
  }, 0);
}

function getPaymentStatusTone(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized.includes('PAID') || normalized.includes('FINISHED')) {
    return '';
  }

  if (normalized.includes('CANCEL') || normalized.includes('FAILED')) {
    return 'error';
  }

  return 'warning';
}

function normalizeOrder(order) {
  if (window.AllegroLive) return window.AllegroLive.normalizeOrder(order);
  const paidAmount = getPaidAmount(order);
  const amount = Number.parseFloat(String(paidAmount?.amount || '0').replace(',', '.'));

  return {
    id: order?.id || '-',
    paymentDate: getPaymentDate(order),
    buyerLogin: order?.buyer?.login || '-',
    buyerName: getBuyerName(order),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: paidAmount?.currency || 'PLN',
    paymentStatus: order?.payment?.status || '-',
    itemsCount: getItemsCount(order),
    buyerEmail: order?.buyer?.email || '-',
    phone: order?.buyer?.phoneNumber || order?.delivery?.address?.phoneNumber || '-',
    city: order?.delivery?.address?.city || order?.invoice?.address?.city || '-',
    createdAt: order?.boughtAt || order?.createdAt || order?.updatedAt || '',
    finishedAt: order?.payment?.finishedAt || order?.finishedAt || '',
  };
}

function getFilteredOrders() {
  const query = ordersSearch.value.trim().toLowerCase();

  if (!query) {
    return allOrders;
  }

  return allOrders.filter((order) => {
    return order.id.toLowerCase().includes(query) || order.buyerLogin.toLowerCase().includes(query);
  });
}

function updateStats(orders) {
  const total = orders.reduce((sum, order) => sum + order.amount, 0);
  const average = orders.length > 0 ? total / orders.length : 0;
  const currency = orders.find((order) => order.currency)?.currency || 'PLN';

  totalOrders.textContent = String(orders.length);
  totalSales.textContent = formatMoney(total, currency);
  averageOrder.textContent = formatMoney(average, currency);
}

function renderOrders() {
  const orders = getFilteredOrders();

  ordersBody.innerHTML = orders
    .map((order) => {
      const paymentTone = getPaymentStatusTone(order.paymentStatus);

      return `
        <tr>
          <td class="order-id">${escapeHtml(order.id)}</td>
          <td>${escapeHtml(order.buyerLogin)}</td>
          <td>${escapeHtml(order.buyerEmail)}</td>
          <td>${escapeHtml(order.phone)}</td>
          <td>${escapeHtml(order.city)}</td>
          <td>${escapeHtml(order.amount.toFixed(2))}</td>
          <td>${escapeHtml(order.currency)}</td>
          <td><span class="badge ${paymentTone}">${escapeHtml(order.paymentStatus)}</span></td>
          <td>${escapeHtml(formatDate(order.createdAt || order.paymentDate))}</td>
          <td>${escapeHtml(formatDate(order.finishedAt))}</td>
        </tr>
      `;
    })
    .join('');

  updateStats(orders);

  if (!authCard.classList.contains('hidden')) {
    return;
  }

  if (allOrders.length === 0) {
    showMessage('Brak zamówień do wyświetlenia.');
    return;
  }

  if (orders.length === 0) {
    showMessage('Brak zamówień pasujących do wyszukiwania.');
    return;
  }

  clearMessage();
}

async function loadOrders() {
  clearMessage();
  setAuthState(false);
  ordersBody.innerHTML = '';
  refreshOrdersButton.disabled = true;
  refreshOrdersButton.textContent = 'Ładowanie...';

  try {
    allOrders = await window.AllegroLive.loadAllegroOrders();
    renderOrders();
  } catch (error) {
    allOrders = [];
    renderOrders();
    if (window.AllegroLive?.isAuthError(error)) {
      setAuthState(true);
      showMessage('Click Connect Allegro / Polacz Allegro, aby pobrac zamowienia.', 'error');
    } else {
      showMessage(error.message || 'Nie udalo sie pobrac zamowien Allegro.', 'error');
    }
  } finally {
    refreshOrdersButton.disabled = false;
    refreshOrdersButton.textContent = 'Odśwież';
  }
}

refreshOrdersButton.addEventListener('click', loadOrders);
ordersSearch.addEventListener('input', renderOrders);
loadOrders();
