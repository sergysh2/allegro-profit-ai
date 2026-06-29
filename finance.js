const refreshButton = document.querySelector('#refresh-finance');
const financeSearch = document.querySelector('#finance-search');
const financeSort = document.querySelector('#finance-sort');
const financeFilter = document.querySelector('#finance-filter');
const financeBody = document.querySelector('#finance-body');
const financeMessage = document.querySelector('#finance-message');
const authCard = document.querySelector('#auth-card');
const totalProfitEl = document.querySelector('#total-profit');
const averageMarginEl = document.querySelector('#average-margin');
const bestProductEl = document.querySelector('#best-product');
const lowMarginCountEl = document.querySelector('#low-margin-count');
const bestScoreEl = document.querySelector('#best-score');
const averageScoreEl = document.querySelector('#average-score');
const highScoreCountEl = document.querySelector('#high-score-count');
const riskScoreCountEl = document.querySelector('#risk-score-count');

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

function formatPercent(value) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function showMessage(message, type = 'info') {
  financeMessage.textContent = message;
  financeMessage.classList.toggle('error', type === 'error');
  financeMessage.classList.remove('hidden');
}

function clearMessage() {
  financeMessage.textContent = '';
  financeMessage.classList.remove('error');
  financeMessage.classList.add('hidden');
}

function setAuthState(isVisible) {
  authCard.classList.toggle('hidden', !isVisible);
}

function getOffers(data) {
  if (Array.isArray(data?.offers)) return data.offers;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function getPrice(offer) {
  return offer?.sellingMode?.price || offer?.price || {};
}

function getPhoto(offer) {
  return offer?.primaryImage?.url || offer?.images?.[0]?.url || '';
}

function getSku(offer) {
  return offer?.external?.id || offer?.productSet?.[0]?.product?.id || '-';
}

function getQuantity(offer) {
  return Number(offer?.stock?.available ?? offer?.quantity ?? 0);
}

function getStatus(offer) {
  return String(offer?.publication?.status || offer?.status || '').toUpperCase();
}

function storageKey(id) {
  return `finance-ai:${id}`;
}

function getStoredCosts(id) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id))) || {};
  } catch {
    return {};
  }
}

function saveCosts(id, costs) {
  localStorage.setItem(storageKey(id), JSON.stringify(costs));
}

function readNumber(value) {
  const number = Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function normalizeProduct(offer) {
  const price = getPrice(offer);
  const amount = readNumber(price?.amount);
  const id = offer?.id || crypto.randomUUID();
  const stored = getStoredCosts(id);

  return {
    id,
    photo: getPhoto(offer),
    name: offer?.name || 'Bez nazwy',
    sku: getSku(offer),
    salePrice: amount,
    currency: price?.currency || 'PLN',
    quantity: getQuantity(offer),
    status: getStatus(offer),
    costs: {
      purchasePrice: readNumber(stored.purchasePrice),
      packagingCost: readNumber(stored.packagingCost),
      deliveryCost: readNumber(stored.deliveryCost),
      adsCost: readNumber(stored.adsCost),
      commissionPercent: stored.commissionPercent === undefined ? 10 : readNumber(stored.commissionPercent),
      vatPercent: stored.vatPercent === undefined ? 23 : readNumber(stored.vatPercent),
    },
  };
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function calculate(product) {
  const revenue = product.salePrice;
  const { purchasePrice, packagingCost, deliveryCost, adsCost, commissionPercent, vatPercent } = product.costs;
  const allegroFee = (revenue * commissionPercent) / 100;
  const vatCost = (revenue * vatPercent) / 100;
  const totalCost = purchasePrice + packagingCost + deliveryCost + adsCost + allegroFee + vatCost;
  const netProfit = revenue - totalCost;
  const roi = purchasePrice > 0 ? (netProfit / purchasePrice) * 100 : 0;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    allegroFee,
    vatCost,
    totalCost,
    netProfit,
    roi,
    margin,
  };
}

function calculateOpportunityScore(product, calc) {
  const marginScore = clamp(calc.margin * 2.5);
  const roiScore = clamp(calc.roi * 1.25);
  const priceScore = product.salePrice <= 0 ? 0 : product.salePrice < 20 ? 45 : product.salePrice <= 500 ? 90 : 72;
  const stockScore = product.quantity <= 0 ? 28 : product.quantity < 3 ? 76 : product.quantity <= 30 ? 96 : 82;
  const activityScore = product.status === 'ACTIVE' || !product.status ? 100 : 42;
  const profitScore = clamp(calc.netProfit * 2);

  const score =
    marginScore * 0.25 +
    roiScore * 0.2 +
    priceScore * 0.1 +
    stockScore * 0.15 +
    activityScore * 0.1 +
    profitScore * 0.2;

  return Math.round(clamp(score));
}

function scoreClass(score) {
  if (score >= 90) return 'score-green';
  if (score >= 70) return 'score-blue';
  if (score >= 50) return 'score-yellow';
  return 'score-red';
}

function getRecommendation(product, calc, score) {
  if (score < 50 || calc.netProfit <= 0) return 'Nie rekomendowane';
  if (calc.margin < 10) return 'Niska marza';
  if (product.quantity === 0 && score >= 70) return 'Rekomendowane dokupienie';
  if (product.quantity > 0 && product.quantity < 3) return 'Konczy sie zapas';
  if (calc.margin >= 30 && product.salePrice > 0) return 'Rekomendowane podniesienie ceny';
  if (calc.netProfit > 0 && (calc.margin >= 20 || calc.roi >= 50)) return 'Wysoka rentownosc';
  if (score >= 70) return 'Rekomendowane dokupienie';
  return 'Nie rekomendowane';
}

function marginClass(margin) {
  if (margin >= 20) return 'profit-good';
  if (margin >= 10) return 'profit-warning';
  return 'profit-danger';
}

function enrichProduct(product) {
  const calc = calculate(product);
  const opportunityScore = calculateOpportunityScore(product, calc);

  return {
    ...product,
    calc,
    opportunityScore,
    recommendation: getRecommendation(product, calc, opportunityScore),
  };
}

function getFilteredProducts() {
  const query = financeSearch.value.trim().toLowerCase();
  const filter = financeFilter.value;
  let rows = products.map(enrichProduct);

  if (query) {
    rows = rows.filter((product) => product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query));
  }

  if (filter === 'promising') {
    rows = rows.filter((product) => product.opportunityScore > 80);
  }

  if (filter === 'risky') {
    rows = rows.filter((product) => product.opportunityScore < 50);
  }

  if (filter === 'out-of-stock') {
    rows = rows.filter((product) => product.quantity <= 0);
  }

  return rows.sort((a, b) => {
    switch (financeSort.value) {
      case 'score-asc':
        return a.opportunityScore - b.opportunityScore;
      case 'profit-desc':
        return b.calc.netProfit - a.calc.netProfit;
      case 'profit-asc':
        return a.calc.netProfit - b.calc.netProfit;
      case 'roi-desc':
        return b.calc.roi - a.calc.roi;
      case 'roi-asc':
        return a.calc.roi - b.calc.roi;
      case 'margin-desc':
        return b.calc.margin - a.calc.margin;
      case 'margin-asc':
        return a.calc.margin - b.calc.margin;
      case 'price-desc':
        return b.salePrice - a.salePrice;
      case 'price-asc':
        return a.salePrice - b.salePrice;
      case 'stock-desc':
        return b.quantity - a.quantity;
      case 'stock-asc':
        return a.quantity - b.quantity;
      default:
        return b.opportunityScore - a.opportunityScore;
    }
  });
}

function updateKpi(rows) {
  const totalProfit = rows.reduce((sum, product) => sum + product.calc.netProfit, 0);
  const averageMargin = rows.length ? rows.reduce((sum, product) => sum + product.calc.margin, 0) / rows.length : 0;
  const best = rows.reduce((current, product) => (!current || product.calc.netProfit > current.calc.netProfit ? product : current), null);
  const lowMargin = rows.filter((product) => product.calc.margin < 10).length;
  const currency = rows.find((product) => product.currency)?.currency || 'PLN';
  const bestScore = rows.reduce((current, product) => Math.max(current, product.opportunityScore), 0);
  const averageScore = rows.length ? rows.reduce((sum, product) => sum + product.opportunityScore, 0) / rows.length : 0;
  const highScore = rows.filter((product) => product.opportunityScore > 80).length;
  const riskScore = rows.filter((product) => product.opportunityScore < 50).length;

  totalProfitEl.textContent = formatMoney(totalProfit, currency);
  averageMarginEl.textContent = `${formatPercent(averageMargin)}%`;
  bestProductEl.textContent = best?.name || '-';
  lowMarginCountEl.textContent = String(lowMargin);
  bestScoreEl.textContent = String(bestScore);
  averageScoreEl.textContent = String(Math.round(averageScore));
  highScoreCountEl.textContent = String(highScore);
  riskScoreCountEl.textContent = String(riskScore);
}

function inputCell(product, key) {
  return `<input class="cost-input" data-id="${escapeHtml(product.id)}" data-key="${key}" type="number" step="0.01" value="${escapeHtml(product.costs[key])}" />`;
}

function renderFinance() {
  const rows = getFilteredProducts();

  financeBody.innerHTML = rows.length
    ? rows
        .map((product) => {
          const photo = product.photo
            ? `<img class="product-photo" src="${escapeHtml(product.photo)}" alt="" />`
            : '<div class="product-photo" aria-hidden="true"></div>';
          const marginTone = marginClass(product.calc.margin);
          const scoreTone = scoreClass(product.opportunityScore);

          return `
            <tr class="${marginTone}">
              <td>${photo}</td>
              <td class="product-name">${escapeHtml(product.name)}</td>
              <td>${escapeHtml(product.sku)}</td>
              <td>${escapeHtml(formatMoney(product.salePrice, product.currency))}</td>
              <td>${escapeHtml(product.quantity)}</td>
              <td>${inputCell(product, 'purchasePrice')}</td>
              <td>${inputCell(product, 'packagingCost')}</td>
              <td>${inputCell(product, 'deliveryCost')}</td>
              <td>${inputCell(product, 'adsCost')}</td>
              <td>${inputCell(product, 'commissionPercent')}</td>
              <td>${inputCell(product, 'vatPercent')}</td>
              <td class="profit-cell">${escapeHtml(formatMoney(product.calc.netProfit, product.currency))}</td>
              <td>${escapeHtml(formatPercent(product.calc.roi))}%</td>
              <td>${escapeHtml(formatPercent(product.calc.margin))}%</td>
              <td><span class="score-pill ${scoreTone}">${escapeHtml(product.opportunityScore)}</span></td>
              <td><span class="recommendation">${escapeHtml(product.recommendation)}</span></td>
            </tr>
          `;
        })
        .join('')
    : '<tr><td colspan="16">Brak produktow do wyswietlenia.</td></tr>';

  updateKpi(rows);
}

function updateProductCost(id, key, value) {
  const product = products.find((item) => item.id === id);
  if (!product) return;

  product.costs[key] = readNumber(value);
  saveCosts(product.id, product.costs);
  renderFinance();
}

async function loadProducts() {
  clearMessage();
  setAuthState(false);
  refreshButton.disabled = true;
  refreshButton.textContent = 'Ladowanie...';

  try {
    const response = await fetch('http://localhost:3000/api/allegro/offers');
    const data = await response.json();

    if (!response.ok) {
      const authError = response.status === 401 || data?.error === 'not_authenticated';
      products = [];
      renderFinance();

      if (authError) {
        setAuthState(true);
        showMessage('Najpierw polacz konto Allegro przez /api/allegro/login', 'error');
      } else {
        showMessage(data?.message || data?.error || 'Allegro API zwrocilo blad.', 'error');
      }
      return;
    }

    products = getOffers(data).map(normalizeProduct);
    renderFinance();

    if (products.length === 0) {
      showMessage('Brak produktow do kalkulacji finansowej.');
    }
  } catch {
    products = [];
    renderFinance();
    setAuthState(true);
    showMessage('Backend nie dziala albo konto Allegro nie jest polaczone.', 'error');
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Odswiez';
  }
}

financeBody.addEventListener('change', (event) => {
  const input = event.target.closest('.cost-input');
  if (!input) return;
  updateProductCost(input.dataset.id, input.dataset.key, input.value);
});

financeSearch.addEventListener('input', renderFinance);
financeSort.addEventListener('change', renderFinance);
financeFilter.addEventListener('change', renderFinance);
refreshButton.addEventListener('click', loadProducts);
loadProducts();
