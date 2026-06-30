const refreshProductsButton = document.querySelector('#refresh-products');
const productsSearch = document.querySelector('#products-search');
const productsSort = document.querySelector('#products-sort');
const productsBody = document.querySelector('#products-body');
const productsMessage = document.querySelector('#products-message');
const authCard = document.querySelector('#auth-card');
const totalProducts = document.querySelector('#total-products');
const activeProducts = document.querySelector('#active-products');
const outOfStockProducts = document.querySelector('#out-of-stock-products');
const averagePrice = document.querySelector('#average-price');

let allProducts = [];

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
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function showMessage(message, type = 'info') {
  productsMessage.textContent = message;
  productsMessage.classList.toggle('error', type === 'error');
  productsMessage.classList.remove('hidden');
}

function clearMessage() {
  productsMessage.textContent = '';
  productsMessage.classList.remove('error');
  productsMessage.classList.add('hidden');
}

function setAuthState(isVisible) {
  authCard.classList.toggle('hidden', !isVisible);
}

function getOffers(data) {
  if (Array.isArray(data?.offers)) {
    return data.offers;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

function getPrice(offer) {
  return offer?.sellingMode?.price || offer?.price || {};
}

function getQuantity(offer) {
  return Number(offer?.stock?.available ?? offer?.publication?.quantity ?? offer?.quantity ?? 0);
}

function getSku(offer) {
  return offer?.external?.id || offer?.productSet?.[0]?.product?.id || '-';
}

function getPhoto(offer) {
  return offer?.primaryImage?.url || offer?.images?.[0]?.url || '';
}

function getViews(offer) {
  return offer?.stats?.visits ?? offer?.stats?.views ?? offer?.visits ?? '-';
}

function getSales(offer) {
  return offer?.stats?.sold ?? offer?.stats?.sales ?? offer?.sold ?? '-';
}

function normalizeProduct(offer) {
  if (window.AllegroLive) return window.AllegroLive.normalizeOffer(offer);
  const price = getPrice(offer);
  const amount = Number.parseFloat(String(price?.amount || '0').replace(',', '.'));
  const quantity = getQuantity(offer);
  const status = offer?.publication?.status || offer?.status || '-';

  return {
    id: offer?.id || '-',
    photo: getPhoto(offer),
    name: offer?.name || 'Bez nazwy',
    sku: getSku(offer),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: price?.currency || 'PLN',
    quantity: Number.isFinite(quantity) ? quantity : 0,
    status,
    views: getViews(offer),
    sales: getSales(offer),
    marketplace: offer?.publication?.marketplace || offer?.marketplace?.id || '-',
    startedAt: offer?.publication?.startedAt || offer?.createdAt || '',
    link: offer?.publication?.link || offer?.url || offer?.id || '-',
  };
}

function isActive(product) {
  return String(product.status).toUpperCase() === 'ACTIVE';
}

function getFilteredProducts() {
  const query = productsSearch.value.trim().toLowerCase();
  let products = allProducts;

  if (query) {
    products = products.filter((product) => {
      return product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
    });
  }

  return [...products].sort((a, b) => {
    switch (productsSort.value) {
      case 'name-desc':
        return b.name.localeCompare(a.name, 'pl');
      case 'price-desc':
        return b.amount - a.amount;
      case 'price-asc':
        return a.amount - b.amount;
      case 'quantity-desc':
        return b.quantity - a.quantity;
      case 'quantity-asc':
        return a.quantity - b.quantity;
      default:
        return a.name.localeCompare(b.name, 'pl');
    }
  });
}

function updateStats(products) {
  const total = products.length;
  const active = products.filter(isActive).length;
  const outOfStock = products.filter((product) => product.quantity <= 0).length;
  const sum = products.reduce((acc, product) => acc + product.amount, 0);
  const average = total > 0 ? sum / total : 0;
  const currency = products.find((product) => product.currency)?.currency || 'PLN';

  totalProducts.textContent = String(total);
  activeProducts.textContent = String(active);
  outOfStockProducts.textContent = String(outOfStock);
  averagePrice.textContent = formatMoney(average, currency);
}

function statusTone(status) {
  const normalized = String(status).toUpperCase();

  if (normalized === 'ACTIVE') {
    return '';
  }

  if (normalized.includes('ENDED') || normalized.includes('INACTIVE')) {
    return 'error';
  }

  return 'warning';
}

function renderProducts() {
  const products = getFilteredProducts();

  productsBody.innerHTML = products
    .map((product) => {
      const photo = product.photo
        ? `<img class="product-photo" src="${escapeHtml(product.photo)}" alt="" />`
        : '<div class="product-photo" aria-hidden="true"></div>';

      return `
        <tr>
          <td>${photo}</td>
          <td>
            <div class="product-cell">
              <span class="product-name">${escapeHtml(product.name)}</span>
            </div>
          </td>
          <td>${escapeHtml(product.id)}</td>
          <td>${escapeHtml(formatMoney(product.amount, product.currency))}</td>
          <td>${escapeHtml(product.currency)}</td>
          <td><span class="badge ${statusTone(product.status)}">${escapeHtml(product.status)}</span></td>
          <td>${escapeHtml(product.marketplace || '-')}</td>
          <td>${escapeHtml(formatDate(product.startedAt))}</td>
          <td>${escapeHtml(product.link || product.id)}</td>
        </tr>
      `;
    })
    .join('');

  updateStats(products);

  if (!authCard.classList.contains('hidden')) {
    return;
  }

  if (allProducts.length === 0) {
    showMessage('Brak produktów do wyświetlenia.');
    return;
  }

  if (products.length === 0) {
    showMessage('Brak produktów pasujących do wyszukiwania lub sortowania.');
    return;
  }

  clearMessage();
}

function renderApiError(status, message) {
  productsBody.innerHTML = `
    <tr>
      <td>-</td>
      <td><span class="product-name">Błąd API Allegro</span></td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td><span class="badge error">${escapeHtml(status)}</span></td>
      <td>-</td>
      <td>-</td>
      <td>${escapeHtml(message)}</td>
    </tr>
  `;
  updateStats([]);
}

async function loadProducts() {
  clearMessage();
  setAuthState(false);
  productsBody.innerHTML = '';
  refreshProductsButton.disabled = true;
  refreshProductsButton.textContent = 'Ładowanie...';

  try {
    allProducts = await window.AllegroLive.loadAllegroOffers();
    renderProducts();
  } catch (error) {
    allProducts = [];
    renderProducts();
    if (window.AllegroLive?.isAuthError(error)) {
      setAuthState(true);
      showMessage('Click Connect Allegro / Polacz Allegro, aby pobrac ogloszenia.', 'error');
    } else {
      showMessage(error.message || 'Nie udalo sie pobrac ogloszen Allegro.', 'error');
      renderApiError(`HTTP ${error.status || '-'}`, error.message || 'Blad API');
    }
  } finally {
    refreshProductsButton.disabled = false;
    refreshProductsButton.textContent = 'Odśwież';
  }
}

refreshProductsButton.addEventListener('click', loadProducts);
productsSearch.addEventListener('input', renderProducts);
productsSort.addEventListener('change', renderProducts);
loadProducts();
