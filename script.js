const refreshButton = document.querySelector('#refresh-dashboard');
const statusCard = document.querySelector('#status-card');
const statusTitle = document.querySelector('#status-title');
const statusMessage = document.querySelector('#status-message');
const statusAction = document.querySelector('#status-action');

const kpi = {
  ordersTotal: document.querySelector('#orders-total'),
  salesTotal: document.querySelector('#sales-total'),
  averageOrder: document.querySelector('#average-order'),
  activeProducts: document.querySelector('#active-products'),
  outOfStock: document.querySelector('#out-of-stock'),
};

const topProductsBody = document.querySelector('#top-products-body');
const recentOrdersBody = document.querySelector('#recent-orders-body');
const alertsList = document.querySelector('#alerts-list');

let orders = [];
let products = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoney(value, currency = 'PLN') {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
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
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function showStatus(title, message, type = 'info', showLogin = false) {
  statusTitle.textContent = title;
  statusMessage.textContent = message;
  statusCard.classList.toggle('error', type === 'error');
  statusCard.classList.remove('hidden');
  statusAction.classList.toggle('hidden', !showLogin);
}

function hideStatus() {
  statusCard.classList.add('hidden');
  statusCard.classList.remove('error');
  statusAction.classList.add('hidden');
}

function getOrders(data) {
  if (Array.isArray(data?.checkoutForms)) return data.checkoutForms;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data)) return data;
  return [];
}

function getOffers(data) {
  if (Array.isArray(data?.offers)) return data.offers;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function getPaidAmount(order) {
  return order?.payment?.paidAmount || order?.summary?.totalToPay || order?.summary?.totalPaid || {};
}

function normalizeOrder(order) {
  const paidAmount = getPaidAmount(order);
  const amount = Number.parseFloat(String(paidAmount?.amount || '0').replace(',', '.'));

  return {
    date: order?.payment?.finishedAt || order?.payment?.startedAt || order?.boughtAt || order?.createdAt || order?.updatedAt,
    buyerLogin: order?.buyer?.login || '-',
    amount: Number.isFinite(amount) ? amount : 0,
    currency: paidAmount?.currency || 'PLN',
    paymentStatus: order?.payment?.status || '-',
  };
}

function getPrice(offer) {
  return offer?.sellingMode?.price || offer?.price || {};
}

function normalizeProduct(offer) {
  const price = getPrice(offer);
  const amount = Number.parseFloat(String(price?.amount || '0').replace(',', '.'));
  const quantity = Number(offer?.stock?.available ?? offer?.quantity ?? 0);

  return {
    name: offer?.name || 'Bez nazwy',
    amount: Number.isFinite(amount) ? amount : 0,
    currency: price?.currency || 'PLN',
    quantity: Number.isFinite(quantity) ? quantity : 0,
    status: offer?.publication?.status || offer?.status || '-',
  };
}

function isActive(product) {
  return String(product.status).toUpperCase() === 'ACTIVE';
}

function paymentTone(status) {
  const normalized = String(status).toUpperCase();
  if (normalized.includes('PAID') || normalized.includes('FINISHED')) return '';
  if (normalized.includes('CANCEL') || normalized.includes('FAILED')) return 'error';
  return 'warning';
}

function productTone(status) {
  const normalized = String(status).toUpperCase();
  if (normalized === 'ACTIVE') return '';
  if (normalized.includes('ENDED') || normalized.includes('INACTIVE')) return 'error';
  return 'warning';
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function updateKpi() {
  const totalSales = orders.reduce((sum, order) => sum + order.amount, 0);
  const average = orders.length > 0 ? totalSales / orders.length : 0;
  const currency = orders.find((order) => order.currency)?.currency || products.find((product) => product.currency)?.currency || 'PLN';

  kpi.ordersTotal.textContent = String(orders.length);
  kpi.salesTotal.textContent = formatMoney(totalSales, currency);
  kpi.averageOrder.textContent = formatMoney(average, currency);
  kpi.activeProducts.textContent = String(products.filter(isActive).length);
  kpi.outOfStock.textContent = String(products.filter((product) => product.quantity <= 0).length);
}

function renderTopProducts() {
  const topProducts = [...products]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  topProductsBody.innerHTML = topProducts.length
    ? topProducts
        .map(
          (product) => `
            <tr>
              <td class="item-name">${escapeHtml(product.name)}</td>
              <td>${escapeHtml(formatMoney(product.amount, product.currency))}</td>
              <td>${escapeHtml(product.quantity)}</td>
              <td><span class="badge ${productTone(product.status)}">${escapeHtml(product.status)}</span></td>
            </tr>
          `,
        )
        .join('')
    : '<tr><td colspan="4">Brak produktów do wyświetlenia.</td></tr>';
}

function renderRecentOrders() {
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 6);

  recentOrdersBody.innerHTML = recentOrders.length
    ? recentOrders
        .map(
          (order) => `
            <tr>
              <td>${escapeHtml(formatDate(order.date))}</td>
              <td>${escapeHtml(order.buyerLogin)}</td>
              <td>${escapeHtml(formatMoney(order.amount, order.currency))}</td>
              <td><span class="badge ${paymentTone(order.paymentStatus)}">${escapeHtml(order.paymentStatus)}</span></td>
            </tr>
          `,
        )
        .join('')
    : '<tr><td colspan="4">Brak zamówień do wyświetlenia.</td></tr>';
}

function renderAlerts() {
  const outOfStock = products.filter((product) => product.quantity <= 0);
  const lowStock = products.filter((product) => product.quantity > 0 && product.quantity < 3);
  const alerts = [];

  outOfStock.forEach((product) => {
    alerts.push({
      title: product.name,
      text: 'Towar bez stanu magazynowego',
      tone: 'error',
    });
  });

  lowStock.forEach((product) => {
    alerts.push({
      title: product.name,
      text: `Niski stan: ${product.quantity} szt.`,
      tone: 'warning',
    });
  });

  alertsList.innerHTML = alerts.length
    ? alerts
        .slice(0, 10)
        .map(
          (alert) => `
            <article class="alert-item">
              <div>
                <strong>${escapeHtml(alert.title)}</strong>
                <span>${escapeHtml(alert.text)}</span>
              </div>
              <span class="badge ${alert.tone}">${alert.tone === 'error' ? 'Pilne' : 'Uwaga'}</span>
            </article>
          `,
        )
        .join('')
    : '<article class="alert-item"><strong>Brak alertów</strong><span>Stany magazynowe wyglądają dobrze.</span></article>';
}

function renderDashboard() {
  updateKpi();
  renderTopProducts();
  renderRecentOrders();
  renderAlerts();
}

async function loadDashboard() {
  hideStatus();
  refreshButton.disabled = true;
  refreshButton.textContent = 'Ładowanie...';

  try {
    const [ordersData, offersData] = await Promise.all([
      fetchJson('http://localhost:3000/api/allegro/orders'),
      fetchJson('http://localhost:3000/api/allegro/offers'),
    ]);

    orders = getOrders(ordersData).map(normalizeOrder);
    products = getOffers(offersData).map(normalizeProduct);
    renderDashboard();

    if (orders.length === 0 && products.length === 0) {
      showStatus('Brak danych', 'Backend działa, ale Allegro nie zwróciło zamówień ani ofert dla tego konta.');
    }
  } catch (error) {
    orders = [];
    products = [];
    renderDashboard();

    if (error.status === 401 || error.data?.error === 'not_authenticated') {
      showStatus('Brak autoryzacji Allegro', 'Najpierw połącz konto Allegro przez backend OAuth.', 'error', true);
    } else if (error.message.includes('Failed to fetch')) {
      showStatus('Backend nie działa', 'Uruchom backend na http://localhost:3000 i odśwież dashboard.', 'error');
    } else {
      showStatus('Błąd Allegro API', error.message || 'Allegro API zwróciło błąd.', 'error');
    }
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Odśwież dashboard';
  }
}

refreshButton.addEventListener('click', loadDashboard);
loadDashboard();
