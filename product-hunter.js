const catalogForm = document.querySelector('#catalog-form');
const catalogPhrase = document.querySelector('#catalog-phrase');
const catalogBody = document.querySelector('#catalog-body');
const catalogAuth = document.querySelector('#catalog-auth');
const messageEl = document.querySelector('#hunter-message');
const csvInput = document.querySelector('#market-csv');
const marketBody = document.querySelector('#market-body');
const exportButton = document.querySelector('#export-market-csv');
const selectedMarketCard = document.querySelector('#selected-market-card');
const selectedMarketDetails = document.querySelector('#selected-market-details');
const marketImportHint = document.querySelector('#market-import-hint');
const filterScore = document.querySelector('#filter-score');
const filterPrice = document.querySelector('#filter-price');
const filterCompetition = document.querySelector('#filter-competition');
const marketSort = document.querySelector('#market-sort');
const marketCountEl = document.querySelector('#market-count');
const marketBestScoreEl = document.querySelector('#market-best-score');
const marketAveragePriceEl = document.querySelector('#market-average-price');
const marketAverageCompetitionEl = document.querySelector('#market-average-competition');

const LISTING_STORAGE_KEY = 'listing-studio:ideas';
const MARKET_STORAGE_KEY = 'product-hunter:market-results';
const SELECTED_MARKET_PRODUCT_KEY = 'selectedMarketProduct';
let catalogProducts = [];
let marketRows = loadMarketRows();
let selectedMarketProduct = getSelectedMarketProduct();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readNumber(value) {
  const number = Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function formatMoney(value, currency = 'PLN') {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function showMessage(message, type = 'info') {
  messageEl.textContent = message;
  messageEl.classList.toggle('error', type === 'error');
  messageEl.classList.remove('hidden');
}

function clearMessage() {
  messageEl.textContent = '';
  messageEl.classList.remove('error');
  messageEl.classList.add('hidden');
}

function setAuthState(isVisible) {
  catalogAuth.classList.toggle('hidden', !isVisible);
}

function formatApiError(status, data) {
  return `Allegro API error: ${status}\n\n${JSON.stringify(data, null, 2)}`;
}

function getSelectedMarketProduct() {
  try {
    return JSON.parse(localStorage.getItem(SELECTED_MARKET_PRODUCT_KEY)) || null;
  } catch {
    return null;
  }
}

function renderSelectedMarketProduct() {
  if (!selectedMarketProduct) {
    selectedMarketCard.classList.add('hidden');
    marketImportHint.classList.add('hidden');
    return;
  }

  selectedMarketCard.classList.remove('hidden');
  marketImportHint.classList.remove('hidden');
  selectedMarketDetails.textContent = [
    selectedMarketProduct.name,
    `SKU: ${selectedMarketProduct.sku || '-'}`,
    `Category: ${selectedMarketProduct.category || '-'}`,
    `Product ID: ${selectedMarketProduct.productId || '-'}`,
  ].join(' | ');
}

function handleMarketImportHash() {
  if (window.location.hash !== '#market-import') return;

  selectedMarketProduct = getSelectedMarketProduct();
  renderSelectedMarketProduct();

  const target = document.querySelector('#market-import');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getProducts(data) {
  return Array.isArray(data?.products) ? data.products : [];
}

function getProductImage(product) {
  return product?.images?.[0]?.url || product?.images?.[0] || '';
}

function getCategoryName(product) {
  const path = product?.category?.path;
  if (Array.isArray(path) && path.length) return path.at(-1)?.name || product?.category?.id || '-';
  return product?.category?.id || '-';
}

async function searchCatalog(event) {
  event.preventDefault();
  const phrase = catalogPhrase.value.trim();
  if (!phrase) return;

  clearMessage();
  setAuthState(false);
  catalogProducts = [];
  renderCatalog();

  try {
    const response = await fetch(`http://localhost:3000/api/allegro/search?phrase=${encodeURIComponent(phrase)}`);
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || data?.error === 'not_authenticated') {
        setAuthState(true);
      }
      showMessage(formatApiError(response.status, data), 'error');
      return;
    }

    catalogProducts = getProducts(data).map((product) => ({
      id: product.id || crypto.randomUUID(),
      name: product.name || 'Bez nazwy',
      image: getProductImage(product),
      categoryId: product?.category?.id || '-',
      categoryName: getCategoryName(product),
      publicationStatus: product?.publication?.status || '-',
    }));

    renderCatalog();
    if (!catalogProducts.length) showMessage('Brak produktow w katalogu dla tej niszy.');
  } catch {
    setAuthState(true);
    showMessage('Backend nie dziala albo konto Allegro nie jest polaczone.', 'error');
  }
}

function renderCatalog() {
  catalogBody.innerHTML = catalogProducts.length
    ? catalogProducts
        .map((product) => {
          const image = product.image
            ? `<img class="product-photo" src="${escapeHtml(product.image)}" alt="" />`
            : '<div class="product-photo" aria-hidden="true"></div>';
          return `
            <tr>
              <td>${image}</td>
              <td class="product-name">${escapeHtml(product.name)}</td>
              <td>${escapeHtml(product.categoryId)}</td>
              <td>${escapeHtml(product.publicationStatus)}</td>
              <td>${escapeHtml(product.id)}</td>
              <td><button class="secondary-button add-catalog-button" type="button" data-id="${escapeHtml(product.id)}">Send to Listing Studio</button></td>
            </tr>
          `;
        })
        .join('')
    : '<tr><td colspan="6">Wpisz nisze i kliknij Szukaj.</td></tr>';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function marketRecommendation(score) {
  if (score > 80) return 'Swietny produkt';
  if (score >= 60) return 'Dobry kandydat';
  if (score >= 40) return 'Mozna przetestowac';
  return 'Nie rekomendowane';
}

function scoreClass(score) {
  if (score >= 70) return 'score-green';
  if (score >= 40) return 'score-yellow';
  return 'score-red';
}

function enrichMarketRow(row) {
  const competitorPrice = readNumber(row.competitor_price);
  const sellerCount = readNumber(row.seller_count);
  const popularity = readNumber(row.popularity);
  const minPrice = readNumber(row.min_price);
  const maxPrice = readNumber(row.max_price);
  const avgPrice = readNumber(row.avg_price);
  const range = Math.max(1, maxPrice - minPrice);
  const competitionScore = clamp(100 - sellerCount * 6);
  const priceScore = competitorPrice > 0 && maxPrice > 0 ? clamp(100 - ((competitorPrice - minPrice) / range) * 65) : 45;
  const demandScore = clamp(popularity * 1.7);
  const spread = avgPrice > 0 ? (avgPrice - minPrice) / avgPrice : 0;
  const profitScore = clamp(spread * 220);
  const opportunityScore = Math.round(
    clamp(competitionScore * 0.25 + priceScore * 0.2 + demandScore * 0.25 + profitScore * 0.3),
  );

  return {
    id: crypto.randomUUID(),
    name: row.name || 'Bez nazwy',
    competitorPrice,
    sellerCount,
    popularity,
    minPrice,
    maxPrice,
    avgPrice,
    sourceUrl: row.source_url || '',
    linkedProduct: selectedMarketProduct,
    competitionScore: Math.round(competitionScore),
    priceScore: Math.round(priceScore),
    demandScore: Math.round(demandScore),
    profitScore: Math.round(profitScore),
    opportunityScore,
    recommendation: marketRecommendation(opportunityScore),
  };
}

function rowsToObjects(rows) {
  const [headers, ...body] = rows;
  if (!headers) return [];
  const keys = headers.map((header) => header.trim());
  return body.map((cells) =>
    keys.reduce((result, key, index) => {
      result[key] = cells[index] ?? '';
      return result;
    }, {}),
  );
}

async function importCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const objects = rowsToObjects(parseCsv(text));
  marketRows = objects.map(enrichMarketRow);
  localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(marketRows));
  renderMarket();
  showMessage(`Zaimportowano ${marketRows.length} wierszy market data.`);
  csvInput.value = '';
}

function loadMarketRows() {
  try {
    return JSON.parse(localStorage.getItem(MARKET_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function getFilteredMarketRows() {
  const minScore = readNumber(filterScore.value);
  const maxPrice = readNumber(filterPrice.value);
  const maxCompetition = readNumber(filterCompetition.value);
  let rows = [...marketRows];

  if (minScore > 0) rows = rows.filter((row) => row.opportunityScore >= minScore);
  if (maxPrice > 0) rows = rows.filter((row) => row.avgPrice <= maxPrice);
  if (maxCompetition > 0) rows = rows.filter((row) => row.sellerCount <= maxCompetition);

  return rows.sort((a, b) => {
    switch (marketSort.value) {
      case 'opportunity-asc':
        return a.opportunityScore - b.opportunityScore;
      case 'avg-price-desc':
        return b.avgPrice - a.avgPrice;
      case 'avg-price-asc':
        return a.avgPrice - b.avgPrice;
      case 'competition-desc':
        return b.sellerCount - a.sellerCount;
      case 'competition-asc':
        return a.sellerCount - b.sellerCount;
      case 'popularity-desc':
        return b.popularity - a.popularity;
      case 'popularity-asc':
        return a.popularity - b.popularity;
      default:
        return b.opportunityScore - a.opportunityScore;
    }
  });
}

function updateMarketKpi(rows) {
  const averagePrice = rows.length ? rows.reduce((sum, row) => sum + row.avgPrice, 0) / rows.length : 0;
  const averageCompetition = rows.length ? rows.reduce((sum, row) => sum + row.sellerCount, 0) / rows.length : 0;
  const bestScore = rows.reduce((best, row) => Math.max(best, row.opportunityScore), 0);

  marketCountEl.textContent = String(rows.length);
  marketBestScoreEl.textContent = String(bestScore);
  marketAveragePriceEl.textContent = formatMoney(averagePrice);
  marketAverageCompetitionEl.textContent = String(Math.round(averageCompetition));
}

function renderMarket() {
  const rows = getFilteredMarketRows();
  marketBody.innerHTML = rows.length
    ? rows
        .map((row) => `
          <tr>
            <td class="product-name">${escapeHtml(row.name)}</td>
            <td>${escapeHtml(formatMoney(row.competitorPrice))}</td>
            <td>${escapeHtml(row.sellerCount)}</td>
            <td>${escapeHtml(row.popularity)}</td>
            <td>${escapeHtml(formatMoney(row.minPrice))}</td>
            <td>${escapeHtml(formatMoney(row.maxPrice))}</td>
            <td>${escapeHtml(formatMoney(row.avgPrice))}</td>
            <td>${escapeHtml(row.competitionScore)}</td>
            <td>${escapeHtml(row.priceScore)}</td>
            <td>${escapeHtml(row.demandScore)}</td>
            <td>${escapeHtml(row.profitScore)}</td>
            <td><span class="score-pill ${scoreClass(row.opportunityScore)}">${escapeHtml(row.opportunityScore)}</span></td>
            <td><span class="recommendation">${escapeHtml(row.recommendation)}</span></td>
            <td>${row.sourceUrl ? `<a href="${escapeHtml(row.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>` : '-'}</td>
            <td class="action-cell">
              <button class="secondary-button add-market-button" type="button" data-id="${escapeHtml(row.id)}">Send to Listing Studio</button>
              ${
                selectedMarketProduct
                  ? `<button class="secondary-button save-analysis-button" type="button" data-id="${escapeHtml(row.id)}">Zapisz analize do Listing Studio</button>`
                  : ''
              }
            </td>
          </tr>
        `)
        .join('')
    : '<tr><td colspan="15">Zaimportuj CSV z danymi rynkowymi.</td></tr>';

  updateMarketKpi(rows);
}

function slug(value) {
  return String(value || 'PRODUKT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 26);
}

function getListingIdeas() {
  try {
    return JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveListingIdea(idea) {
  localStorage.setItem(LISTING_STORAGE_KEY, JSON.stringify([idea, ...getListingIdeas()]));
  showMessage('Produkt wyslany do Listing Studio.');
}

function updateSelectedListingWithMarket(row) {
  if (!selectedMarketProduct) {
    showMessage('Najpierw wybierz produkt w Listing Studio.', 'error');
    return;
  }

  const ideas = getListingIdeas();
  let updatedCount = 0;
  const updatedIdeas = ideas.map((idea) => {
    const sameSku = selectedMarketProduct.sku && idea.sku === selectedMarketProduct.sku;
    const sameProductId = selectedMarketProduct.productId && (idea.productId === selectedMarketProduct.productId || idea.allegroProductId === selectedMarketProduct.productId);
    if (!sameSku && !sameProductId) return idea;

    updatedCount += 1;
    return {
      ...idea,
      marketAvgPrice: row.avgPrice,
      marketMinPrice: row.minPrice,
      marketMaxPrice: row.maxPrice,
      sellerCount: row.sellerCount,
      popularity: row.popularity,
      opportunityScore: row.opportunityScore,
      marketRecommendation: row.recommendation,
      marketSourceUrl: row.sourceUrl,
      marketUpdatedAt: new Date().toISOString(),
    };
  });

  if (updatedCount === 0) {
    showMessage('Nie znaleziono produktu w Listing Studio dla wybranej analizy.', 'error');
    return;
  }

  localStorage.setItem(LISTING_STORAGE_KEY, JSON.stringify(updatedIdeas));
  localStorage.removeItem(SELECTED_MARKET_PRODUCT_KEY);
  selectedMarketProduct = null;
  renderSelectedMarketProduct();
  renderMarket();
  showMessage('Analiza rynkowa zapisana w Listing Studio.');
}

function sendCatalogToListingStudio(id) {
  const product = catalogProducts.find((item) => item.id === id);
  if (!product) return;

  saveListingIdea({
    id: crypto.randomUUID(),
    supplierUrl: '',
    productId: product.id,
    productName: product.name,
    name: `${product.name} | Allegro | szybka wysylka`,
    purchasePrice: 0,
    deliveryCost: 0,
    packagingCost: 0,
    commissionPercent: 12,
    vatPercent: 23,
    desiredMarginPercent: 25,
    imageUrl: product.image,
    category: product.categoryName || product.categoryId,
    keywords: catalogPhrase.value.trim(),
    quantity: 1,
    sku: `${slug(product.name)}-${Date.now().toString().slice(-5)}`,
    price: 0,
    totalCost: 0,
    allegroFee: 0,
    vatCost: 0,
    profit: 0,
    roi: 0,
    margin: 0,
    score: 0,
    recommendation: 'Uzupelnij dane rynkowe',
    shortDescription: `${product.name} z katalogu produktow Allegro.`,
    description: `Produkt ${product.name} zostal dodany z Product Catalog Hunter. Market prices require imported or external legal data source.`,
    bullets: [`Product ID: ${product.id}`, `Category ID: ${product.categoryId}`, `Publication status: ${product.publicationStatus}`],
    createdAt: new Date().toISOString(),
  });
}

function sendMarketToListingStudio(id) {
  const row = marketRows.find((item) => item.id === id);
  if (!row) return;
  const purchasePrice = row.minPrice;
  const price = row.avgPrice || row.competitorPrice;
  const profit = price - purchasePrice - price * 0.12 - price * 0.23;
  const roi = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
  const margin = price > 0 ? (profit / price) * 100 : 0;

  saveListingIdea({
    id: crypto.randomUUID(),
    supplierUrl: row.sourceUrl,
    productName: row.name,
    name: `${row.name} | Allegro | szybka wysylka`,
    purchasePrice,
    deliveryCost: 0,
    packagingCost: 0,
    commissionPercent: 12,
    vatPercent: 23,
    desiredMarginPercent: Math.max(10, Math.round(margin)),
    imageUrl: '',
    category: 'Market import',
    keywords: row.name,
    quantity: 1,
    sku: `${slug(row.name)}-${Date.now().toString().slice(-5)}`,
    price,
    totalCost: purchasePrice,
    allegroFee: price * 0.12,
    vatCost: price * 0.23,
    profit,
    roi,
    margin,
    score: row.opportunityScore,
    recommendation: row.recommendation,
    shortDescription: `${row.name} z Market Hunter Import.`,
    description: `Produkt ${row.name} zostal dodany z legalnie importowanych danych rynkowych. Opportunity Score: ${row.opportunityScore}.`,
    bullets: [`Seller count: ${row.sellerCount}`, `Avg price: ${formatMoney(row.avgPrice)}`, `Popularity: ${row.popularity}`],
    createdAt: new Date().toISOString(),
  });
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportMarketCsv() {
  const rows = getFilteredMarketRows();
  if (!rows.length) {
    showMessage('Brak wynikow do eksportu.', 'error');
    return;
  }

  const header = 'name,competitor_price,seller_count,popularity,min_price,max_price,avg_price,source_url,competition_score,price_score,demand_score,profit_score,opportunity_score,recommendation';
  const csv = [
    header,
    ...rows.map((row) =>
      [
        row.name,
        row.competitorPrice,
        row.sellerCount,
        row.popularity,
        row.minPrice,
        row.maxPrice,
        row.avgPrice,
        row.sourceUrl,
        row.competitionScore,
        row.priceScore,
        row.demandScore,
        row.profitScore,
        row.opportunityScore,
        row.recommendation,
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'product-hunter-market-results.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

catalogForm.addEventListener('submit', searchCatalog);
catalogBody.addEventListener('click', (event) => {
  const button = event.target.closest('.add-catalog-button');
  if (!button) return;
  sendCatalogToListingStudio(button.dataset.id);
});
csvInput.addEventListener('change', importCsv);
filterScore.addEventListener('input', renderMarket);
filterPrice.addEventListener('input', renderMarket);
filterCompetition.addEventListener('input', renderMarket);
marketSort.addEventListener('change', renderMarket);
marketBody.addEventListener('click', (event) => {
  const saveAnalysisButton = event.target.closest('.save-analysis-button');
  if (saveAnalysisButton) {
    const row = marketRows.find((item) => item.id === saveAnalysisButton.dataset.id);
    if (row) updateSelectedListingWithMarket(row);
    return;
  }

  const button = event.target.closest('.add-market-button');
  if (!button) return;
  sendMarketToListingStudio(button.dataset.id);
});
exportButton.addEventListener('click', exportMarketCsv);

renderCatalog();
renderSelectedMarketProduct();
renderMarket();
handleMarketImportHash();
