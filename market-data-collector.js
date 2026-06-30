const supplierInput = document.querySelector('#supplier-file');
const marketInput = document.querySelector('#market-file');
const autoMatchButton = document.querySelector('#auto-match');
const exportHunterButton = document.querySelector('#export-hunter-csv');
const sendBestButton = document.querySelector('#send-best');
const messageEl = document.querySelector('#collector-message');
const collectorBody = document.querySelector('#collector-body');
const supplierCountEl = document.querySelector('#supplier-count');
const marketSourceCountEl = document.querySelector('#market-source-count');
const matchedCountEl = document.querySelector('#matched-count');
const buyCountEl = document.querySelector('#buy-count');

const SUPPLIER_KEY = 'market-data-collector:supplier';
const MARKET_KEY = 'market-data-collector:market';
const MATCHED_KEY = 'market-data-collector:matched';
const LISTING_KEY = 'listing-studio:ideas';
const SHARED_MARKET_KEY = 'allegroProfitMarketData';

let supplierRows = loadRows(SUPPLIER_KEY);
let marketRows = loadRows(MARKET_KEY);
let matchedRows = loadRows(MATCHED_KEY);

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

function formatMoney(value) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
  }).format(value);
}

function showMessage(message, type = 'info') {
  messageEl.textContent = message;
  messageEl.classList.toggle('error', type === 'error');
  messageEl.classList.remove('hidden');
}

function loadRows(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function saveRows(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function saveSharedMarketData(rows) {
  const sharedRows = rows.map((row) => ({
    name: row.name || '',
    competitor_price: readNumber(row.competitor_price),
    seller_count: readNumber(row.seller_count),
    popularity: readNumber(row.popularity),
    min_price: readNumber(row.min_price),
    max_price: readNumber(row.max_price),
    avg_price: readNumber(row.avg_price),
    source_url: row.source_url || '',
  }));
  localStorage.setItem(SHARED_MARKET_KEY, JSON.stringify(sharedRows));
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

async function importCsv(file, type) {
  if (!file) return;
  const text = await file.text();
  const objects = rowsToObjects(parseCsv(text));

  if (type === 'supplier') {
    supplierRows = objects.map((row) => ({
      supplier_name: row.supplier_name || '',
      product_name: row.product_name || '',
      sku: row.sku || '',
      purchase_price: readNumber(row.purchase_price),
      stock: readNumber(row.stock),
      ean: row.ean || '',
      category: row.category || '',
      image_url: row.image_url || '',
      source_url: row.source_url || '',
    }));
    saveRows(SUPPLIER_KEY, supplierRows);
    showMessage(`Imported supplier rows: ${supplierRows.length}`);
  }

  if (type === 'market') {
    marketRows = objects.map((row) => ({
      name: row.name || '',
      competitor_price: readNumber(row.competitor_price),
      seller_count: readNumber(row.seller_count),
      popularity: readNumber(row.popularity),
      min_price: readNumber(row.min_price),
      max_price: readNumber(row.max_price),
      avg_price: readNumber(row.avg_price),
      source_url: row.source_url || '',
      sku: row.sku || '',
      ean: row.ean || '',
    }));
    saveRows(MARKET_KEY, marketRows);
    saveSharedMarketData(marketRows);
    showMessage(`Imported market rows: ${marketRows.length}`);
  }

  render();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameSimilarity(left, right) {
  const leftWords = new Set(normalizeText(left).split(' ').filter((word) => word.length > 2));
  const rightWords = new Set(normalizeText(right).split(' ').filter((word) => word.length > 2));
  if (!leftWords.size || !rightWords.size) return 0;
  const common = [...leftWords].filter((word) => rightWords.has(word)).length;
  return common / Math.max(leftWords.size, rightWords.size);
}

function findMarketMatch(supplier) {
  const bySku = marketRows.find((market) => supplier.sku && market.sku && supplier.sku === market.sku);
  if (bySku) return bySku;

  const byEan = marketRows.find((market) => supplier.ean && market.ean && supplier.ean === market.ean);
  if (byEan) return byEan;

  return marketRows
    .map((market) => ({
      market,
      similarity: nameSimilarity(supplier.product_name, market.name),
    }))
    .filter((item) => item.similarity >= 0.35)
    .sort((a, b) => b.similarity - a.similarity)[0]?.market;
}

function recommendation(margin, sellerCount) {
  if (margin > 35 && sellerCount < 20) return 'BUY';
  if (margin < 20 || sellerCount > 50) return 'AVOID';
  if (margin >= 20 && margin <= 35) return 'WATCH';
  return 'WATCH';
}

function opportunityScore(margin, sellerCount, popularity) {
  const marginScore = Math.min(100, Math.max(0, margin * 2));
  const competitionScore = Math.min(100, Math.max(0, 100 - sellerCount * 2));
  const demandScore = Math.min(100, Math.max(0, popularity * 1.5));
  return Math.round(marginScore * 0.45 + competitionScore * 0.3 + demandScore * 0.25);
}

function autoMatch() {
  matchedRows = supplierRows
    .map((supplier) => {
      const market = findMarketMatch(supplier);
      if (!market) return null;
      const margin = market.avg_price > 0 ? ((market.avg_price - supplier.purchase_price) / market.avg_price) * 100 : 0;
      const score = opportunityScore(margin, market.seller_count, market.popularity);

      return {
        supplier,
        market,
        estimatedMargin: margin,
        opportunityScore: score,
        recommendation: recommendation(margin, market.seller_count),
      };
    })
    .filter(Boolean);

  saveRows(MATCHED_KEY, matchedRows);
  showMessage(`Auto matched products: ${matchedRows.length}`);
  render();
}

function render() {
  supplierCountEl.textContent = String(supplierRows.length);
  marketSourceCountEl.textContent = String(marketRows.length);
  matchedCountEl.textContent = String(matchedRows.length);
  buyCountEl.textContent = String(matchedRows.filter((row) => row.recommendation === 'BUY').length);

  collectorBody.innerHTML = matchedRows.length
    ? matchedRows
        .map((row) => `
          <tr>
            <td class="product-name">${escapeHtml(row.supplier.product_name)}</td>
            <td>${escapeHtml(formatMoney(row.supplier.purchase_price))}</td>
            <td>${escapeHtml(row.supplier.stock)}</td>
            <td>${escapeHtml(formatMoney(row.market.avg_price))}</td>
            <td>${escapeHtml(row.market.seller_count)}</td>
            <td>${escapeHtml(row.market.popularity)}</td>
            <td>${escapeHtml(row.estimatedMargin.toFixed(2))}%</td>
            <td><span class="score-pill ${row.opportunityScore >= 70 ? 'score-green' : row.opportunityScore >= 40 ? 'score-yellow' : 'score-red'}">${escapeHtml(row.opportunityScore)}</span></td>
            <td><span class="recommendation">${escapeHtml(row.recommendation)}</span></td>
          </tr>
        `)
        .join('')
    : '<tr><td colspan="9">Zaimportuj dane i kliknij Auto match.</td></tr>';
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportHunterCsv() {
  if (!matchedRows.length) {
    showMessage('No matched rows to export.', 'error');
    return;
  }

  const header = 'name,competitor_price,seller_count,popularity,min_price,max_price,avg_price,source_url';
  const csv = [
    header,
    ...matchedRows.map((row) =>
      [
        row.market.name || row.supplier.product_name,
        row.market.competitor_price,
        row.market.seller_count,
        row.market.popularity,
        row.market.min_price,
        row.market.max_price,
        row.market.avg_price,
        row.market.source_url || row.supplier.source_url,
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'product-hunter-import.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getListingIdeas() {
  try {
    return JSON.parse(localStorage.getItem(LISTING_KEY)) || [];
  } catch {
    return [];
  }
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

function sendBestToListingStudio() {
  const best = matchedRows.filter((row) => row.recommendation === 'BUY');
  if (!best.length) {
    showMessage('No BUY products to send.', 'error');
    return;
  }

  const ideas = best.map((row) => {
    const price = row.market.avg_price;
    const purchasePrice = row.supplier.purchase_price;
    const profit = price - purchasePrice - price * 0.12 - price * 0.23;
    const roi = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
    const margin = price > 0 ? (profit / price) * 100 : 0;

    return {
      id: crypto.randomUUID(),
      supplierUrl: row.supplier.source_url || row.market.source_url,
      productName: row.supplier.product_name,
      name: `${row.supplier.product_name} | Allegro | szybka wysylka`,
      purchasePrice,
      deliveryCost: 0,
      packagingCost: 0,
      commissionPercent: 12,
      vatPercent: 23,
      desiredMarginPercent: Math.max(10, Math.round(margin)),
      imageUrl: row.supplier.image_url,
      category: row.supplier.category,
      keywords: row.supplier.product_name,
      quantity: row.supplier.stock,
      sku: row.supplier.sku || `${slug(row.supplier.product_name)}-${Date.now().toString().slice(-5)}`,
      price,
      totalCost: purchasePrice,
      allegroFee: price * 0.12,
      vatCost: price * 0.23,
      profit,
      roi,
      margin,
      score: row.opportunityScore,
      recommendation: row.recommendation,
      marketAvgPrice: row.market.avg_price,
      marketMinPrice: row.market.min_price,
      marketMaxPrice: row.market.max_price,
      sellerCount: row.market.seller_count,
      popularity: row.market.popularity,
      opportunityScore: row.opportunityScore,
      marketRecommendation: row.recommendation,
      shortDescription: `${row.supplier.product_name} z Market Data Collector.`,
      description: `Produkt przygotowany z legalnych danych dostawcy i market CSV. Recommendation: ${row.recommendation}.`,
      bullets: [`Supplier: ${row.supplier.supplier_name}`, `EAN: ${row.supplier.ean || '-'}`, `Market avg price: ${formatMoney(row.market.avg_price)}`],
      createdAt: new Date().toISOString(),
    };
  });

  localStorage.setItem(LISTING_KEY, JSON.stringify([...ideas, ...getListingIdeas()]));
  showMessage(`Sent BUY products to Listing Studio: ${ideas.length}`);
}

supplierInput.addEventListener('change', (event) => {
  importCsv(event.target.files?.[0], 'supplier');
  supplierInput.value = '';
});
marketInput.addEventListener('change', (event) => {
  importCsv(event.target.files?.[0], 'market');
  marketInput.value = '';
});
autoMatchButton.addEventListener('click', autoMatch);
exportHunterButton.addEventListener('click', exportHunterCsv);
sendBestButton.addEventListener('click', sendBestToListingStudio);

render();
