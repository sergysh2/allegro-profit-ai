const form = document.querySelector('#listing-form');
const generateButton = document.querySelector('#generate-listing');
const saveButton = document.querySelector('#save-idea');
const exportBaseLinkerButton = document.querySelector('#export-baselinker');
const exportAllegroButton = document.querySelector('#export-allegro');
const ideasBody = document.querySelector('#ideas-body');
const messageEl = document.querySelector('#studio-message');
const marketMessageEl = document.querySelector('#market-message');
const aiStatus = document.querySelector('#ai-status');
const useMarketDataButton = document.querySelector('#use-market-data');

const resultEls = {
  name: document.querySelector('#result-name'),
  sku: document.querySelector('#result-sku'),
  price: document.querySelector('#result-price'),
  profit: document.querySelector('#result-profit'),
  roi: document.querySelector('#result-roi'),
  margin: document.querySelector('#result-margin'),
  score: document.querySelector('#result-score'),
  aiScore: document.querySelector('#result-ai-score'),
  recommendation: document.querySelector('#result-recommendation'),
  short: document.querySelector('#result-short'),
  bullets: document.querySelector('#result-bullets'),
  long: document.querySelector('#result-long'),
  seo: document.querySelector('#result-seo'),
  priceRecommendation: document.querySelector('#result-price-recommendation'),
  riskNotes: document.querySelector('#result-risk-notes'),
  marketPrice: document.querySelector('#result-market-price'),
  competitionLevel: document.querySelector('#result-competition-level'),
  marketPosition: document.querySelector('#result-market-position'),
  pricingAdvice: document.querySelector('#result-pricing-advice'),
  keywordAdvice: document.querySelector('#result-keyword-advice'),
};

const STORAGE_KEY = 'listing-studio:ideas';
const SELECTED_MARKET_PRODUCT_KEY = 'selectedMarketProduct';
const PRODUCT_HUNTER_MARKET_KEY = 'product-hunter:market-results';
const COLLECTOR_MARKET_KEY = 'market-data-collector:market';
const COLLECTOR_MATCHED_KEY = 'market-data-collector:matched';
let currentListing = null;
let isGenerating = false;

window.openMarketDataForSku = function (sku) {
  console.log('openMarketDataForSku', sku);
  const ideas = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const idea = ideas.find((item) => item.sku === sku);

  if (!idea) {
    alert('Nie znaleziono produktu: ' + sku);
    return;
  }

  localStorage.setItem(SELECTED_MARKET_PRODUCT_KEY, JSON.stringify(idea));
  window.location.href = 'product-hunter.html#market-import';
};

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

function formatPercent(value) {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function showMessage(text, type = 'info') {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', type === 'error');
  messageEl.classList.remove('hidden');
}

function hideMessage() {
  messageEl.textContent = '';
  messageEl.classList.remove('error');
  messageEl.classList.add('hidden');
}

function showMarketMessage(text, type = 'info') {
  marketMessageEl.textContent = text;
  marketMessageEl.classList.toggle('error', type === 'error');
  marketMessageEl.classList.remove('hidden');
}

function hideMarketMessage() {
  marketMessageEl.textContent = '';
  marketMessageEl.classList.remove('error');
  marketMessageEl.classList.add('hidden');
}

function setGenerating(isActive) {
  isGenerating = isActive;
  aiStatus.classList.toggle('hidden', !isActive);
  generateButton.disabled = isActive;
  form.querySelectorAll('button[type="submit"]').forEach((button) => {
    button.disabled = isActive;
    button.textContent = isActive ? 'AI is generating...' : 'Generuj listing';
  });
}

function getIdeas() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function loadSavedIdeas() {
  return getIdeas();
}

function setIdeas(ideas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
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

function readJsonStorage(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameSimilarity(left, right) {
  const leftWords = new Set(normalizeName(left).split(' ').filter(Boolean));
  const rightWords = new Set(normalizeName(right).split(' ').filter(Boolean));
  if (!leftWords.size || !rightWords.size) return 0;
  const common = [...leftWords].filter((word) => rightWords.has(word)).length;
  return common / Math.max(leftWords.size, rightWords.size);
}

function normalizeMarketRow(row, source = 'market') {
  const market = row?.market || row || {};
  const supplier = row?.supplier || {};
  return {
    id: market.id || row?.id || crypto.randomUUID(),
    name: market.name || market.product_name || supplier.product_name || row?.name || '',
    sku: market.sku || supplier.sku || row?.sku || '',
    competitorPrice: readNumber(market.competitorPrice ?? market.competitor_price ?? row?.competitorPrice),
    sellerCount: readNumber(market.sellerCount ?? market.seller_count ?? row?.sellerCount),
    popularity: readNumber(market.popularity ?? row?.popularity),
    minPrice: readNumber(market.minPrice ?? market.min_price ?? row?.minPrice),
    maxPrice: readNumber(market.maxPrice ?? market.max_price ?? row?.maxPrice),
    avgPrice: readNumber(market.avgPrice ?? market.avg_price ?? row?.avgPrice),
    sourceUrl: market.sourceUrl || market.source_url || supplier.source_url || row?.sourceUrl || row?.marketSourceUrl || '',
    opportunityScore: readNumber(row?.opportunityScore ?? row?.marketOpportunityScore),
    recommendation: row?.recommendation || row?.marketRecommendation || '',
    source,
  };
}

function getMarketCandidates() {
  const productHunterRows = readJsonStorage(PRODUCT_HUNTER_MARKET_KEY).map((row) => normalizeMarketRow(row, 'Product Hunter Import'));
  const collectorMarketRows = readJsonStorage(COLLECTOR_MARKET_KEY).map((row) => normalizeMarketRow(row, 'Market Data Collector'));
  const collectorMatchedRows = readJsonStorage(COLLECTOR_MATCHED_KEY).map((row) => normalizeMarketRow(row, 'Market Data Collector match'));
  const ideaRows = getIdeas()
    .filter((idea) => idea.marketAvgPrice || idea.sellerCount || idea.marketSourceUrl)
    .map((idea) =>
      normalizeMarketRow(
        {
          ...idea,
          name: idea.name || idea.productName,
          avgPrice: idea.marketAvgPrice,
          minPrice: idea.marketMinPrice,
          maxPrice: idea.marketMaxPrice,
          sourceUrl: idea.marketSourceUrl,
          recommendation: idea.marketRecommendation,
        },
        'Listing Studio',
      ),
    );

  return [...ideaRows, ...productHunterRows, ...collectorMatchedRows, ...collectorMarketRows].filter((row) => row.name || row.avgPrice || row.sourceUrl);
}

function findBestMarketData(input) {
  const candidates = getMarketCandidates();
  if (!candidates.length) return null;

  const productName = input.productName || '';
  const keywords = input.keywords || '';

  return candidates
    .map((row) => ({
      row,
      score:
        Math.max(nameSimilarity(productName, row.name), nameSimilarity(keywords, row.name)) +
        (row.avgPrice > 0 ? 0.08 : 0) +
        (row.sellerCount > 0 ? 0.05 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.row;
}

function fillMarketFields(row) {
  form.elements.marketAvgPrice.value = row.avgPrice || '';
  form.elements.marketMinPrice.value = row.minPrice || '';
  form.elements.marketMaxPrice.value = row.maxPrice || '';
  form.elements.sellerCount.value = row.sellerCount || '';
  form.elements.popularity.value = row.popularity || '';
  form.elements.marketSourceUrl.value = row.sourceUrl || '';
  form.elements.marketNotes.value = [
    row.name ? `Market product: ${row.name}` : '',
    row.source ? `Source: ${row.source}` : '',
    row.recommendation ? `Recommendation: ${row.recommendation}` : '',
    row.opportunityScore ? `Opportunity Score: ${row.opportunityScore}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function getFormData() {
  const data = new FormData(form);
  return {
    supplierUrl: String(data.get('supplierUrl') || '').trim(),
    productName: String(data.get('productName') || '').trim(),
    purchasePrice: readNumber(data.get('purchasePrice')),
    deliveryCost: readNumber(data.get('deliveryCost')),
    packagingCost: readNumber(data.get('packagingCost')),
    adsCost: readNumber(data.get('adsCost')),
    commissionPercent: readNumber(data.get('commissionPercent')),
    vatPercent: readNumber(data.get('vatPercent')),
    desiredMarginPercent: readNumber(data.get('desiredMarginPercent')),
    imageUrl: String(data.get('imageUrl') || '').trim(),
    category: String(data.get('category') || '').trim(),
    keywords: String(data.get('keywords') || '').trim(),
    quantity: Math.max(0, Math.round(readNumber(data.get('quantity')))),
    marketAvgPrice: readNumber(data.get('marketAvgPrice')),
    marketMinPrice: readNumber(data.get('marketMinPrice')),
    marketMaxPrice: readNumber(data.get('marketMaxPrice')),
    sellerCount: readNumber(data.get('sellerCount')),
    popularity: readNumber(data.get('popularity')),
    marketSourceUrl: String(data.get('marketSourceUrl') || '').trim(),
    marketNotes: String(data.get('marketNotes') || '').trim(),
  };
}

function calculateScore(input, margin, roi) {
  let score = 0;
  if (margin >= 25) score += 30;
  if (roi >= 50) score += 25;
  if (input.quantity >= 10) score += 10;
  if (input.keywords) score += 10;
  if (input.imageUrl) score += 10;
  if (input.category) score += 10;
  if (input.supplierUrl) score += 5;
  return Math.min(100, score);
}

function getRecommendation(score, netProfit, margin) {
  if (netProfit < 0) return 'Produkt stratny';
  if (margin < 10) return 'Za niska marza';
  if (score >= 80) return 'Dobry kandydat do sprzedazy';
  if (score >= 60) return 'Warto przetestowac';
  if (score >= 40) return 'Wymaga poprawy';
  return 'Nie rekomenduje';
}

function buildListing(input, aiData) {
  const productName = input.productName || 'Nowy produkt';
  const cleanCategory = input.category || 'Allegro';
  const keywords = String(input.keywords || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const totalCost = input.purchasePrice + input.deliveryCost + input.packagingCost + input.adsCost;
  const targetPrice = readNumber(aiData?.suggestedPrice) || input.marketAvgPrice || totalCost / Math.max(0.05, 1 - input.desiredMarginPercent / 100);
  const allegroFee = (targetPrice * input.commissionPercent) / 100;
  const vatCost = (targetPrice * input.vatPercent) / 100;
  const netProfit = targetPrice - totalCost - allegroFee - vatCost;
  const roi = input.purchasePrice > 0 ? (netProfit / input.purchasePrice) * 100 : 0;
  const margin = targetPrice > 0 ? (netProfit / targetPrice) * 100 : 0;
  const score = calculateScore(input, margin, roi);
  const aiScore = Math.max(0, Math.min(100, Math.round(readNumber(aiData?.score))));
  const priceRecommendation = aiData?.priceRecommendation || aiData?.aiRecommendation || '';
  const riskNotes = Array.isArray(aiData?.riskNotes) ? aiData.riskNotes : [];
  const marketInsight = aiData?.marketInsight && typeof aiData.marketInsight === 'object' ? aiData.marketInsight : {};
  const recommendation = aiData?.aiRecommendation || priceRecommendation || getRecommendation(score, netProfit, margin);
  const sku = `${slug(productName)}-${Date.now().toString().slice(-5)}`;

  return {
    id: crypto.randomUUID(),
    supplierUrl: input.supplierUrl,
    productName,
    purchasePrice: input.purchasePrice,
    deliveryCost: input.deliveryCost,
    packagingCost: input.packagingCost,
    adsCost: input.adsCost,
    commissionPercent: input.commissionPercent,
    vatPercent: input.vatPercent,
    desiredMarginPercent: input.desiredMarginPercent,
    imageUrl: input.imageUrl,
    category: cleanCategory,
    keywords: input.keywords,
    quantity: input.quantity,
    marketAvgPrice: input.marketAvgPrice,
    marketMinPrice: input.marketMinPrice,
    marketMaxPrice: input.marketMaxPrice,
    sellerCount: input.sellerCount,
    popularity: input.popularity,
    marketSourceUrl: input.marketSourceUrl,
    marketNotes: input.marketNotes,
    sku,
    price: targetPrice,
    totalCost,
    allegroFee,
    vatCost,
    profit: netProfit,
    roi,
    margin,
    score,
    aiScore,
    recommendation,
    shortDescription: aiData?.shortDescription || '',
    description: aiData?.longDescription || '',
    bullets: Array.isArray(aiData?.bulletPoints) ? aiData.bulletPoints : [],
    seoKeywords: Array.isArray(aiData?.seoKeywords) ? aiData.seoKeywords : keywords,
    priceRecommendation,
    riskNotes,
    marketInsight: {
      recommendedPrice: marketInsight.recommendedPrice || (input.marketAvgPrice ? formatMoney(input.marketAvgPrice) : 'Dane rynkowe nie sa podlaczone.'),
      competitionLevel: marketInsight.competitionLevel || (input.sellerCount ? `${input.sellerCount} sprzedawcow` : 'Brak danych rynkowych.'),
      marketPosition: marketInsight.marketPosition || 'Brak analizy pozycji rynkowej.',
      pricingAdvice: marketInsight.pricingAdvice || 'Dodaj lub wybierz dane rynkowe, aby otrzymac dokladniejsza rekomendacje ceny.',
      keywordAdvice: marketInsight.keywordAdvice || 'Dodaj dane rynkowe, aby porownac slowa kluczowe z rynkiem.',
    },
    aiRecommendation: aiData?.aiRecommendation || recommendation,
    name: aiData?.title || `${productName} | ${cleanCategory} | szybka wysylka`,
    createdAt: new Date().toISOString(),
  };
}

function renderListing(listing) {
  currentListing = listing;
  resultEls.name.textContent = listing.name;
  resultEls.sku.textContent = listing.sku;
  resultEls.price.textContent = formatMoney(listing.price);
  resultEls.profit.textContent = formatMoney(listing.profit);
  resultEls.roi.textContent = `${formatPercent(listing.roi)}%`;
  resultEls.margin.textContent = `${formatPercent(listing.margin)}%`;
  resultEls.score.textContent = String(listing.score);
  resultEls.aiScore.textContent = String(listing.aiScore || 0);
  resultEls.recommendation.textContent = listing.recommendation;
  resultEls.short.textContent = listing.shortDescription;
  resultEls.long.textContent = listing.description;
  resultEls.bullets.innerHTML = listing.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  resultEls.seo.textContent = listing.seoKeywords?.length ? listing.seoKeywords.join(', ') : '-';
  resultEls.priceRecommendation.textContent = listing.priceRecommendation || '-';
  resultEls.riskNotes.innerHTML = listing.riskNotes?.length
    ? listing.riskNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>Brak dodatkowych ryzyk.</li>';
  resultEls.marketPrice.textContent = listing.marketInsight?.recommendedPrice || '-';
  resultEls.competitionLevel.textContent = listing.marketInsight?.competitionLevel || '-';
  resultEls.marketPosition.textContent = listing.marketInsight?.marketPosition || '-';
  resultEls.pricingAdvice.textContent = listing.marketInsight?.pricingAdvice || '-';
  resultEls.keywordAdvice.textContent = listing.marketInsight?.keywordAdvice || '-';
}

function buildMarketData(input) {
  const hasMarketData =
    input.marketAvgPrice > 0 ||
    input.marketMinPrice > 0 ||
    input.marketMaxPrice > 0 ||
    input.sellerCount > 0 ||
    input.popularity > 0 ||
    input.marketSourceUrl ||
    input.marketNotes;

  if (!hasMarketData) return null;

  return {
    avgPrice: input.marketAvgPrice,
    minPrice: input.marketMinPrice,
    maxPrice: input.marketMaxPrice,
    sellerCount: input.sellerCount,
    popularity: input.popularity,
    sourceUrl: input.marketSourceUrl,
    notes: input.marketNotes,
  };
}

async function requestAiListing(input) {
  const marketData = buildMarketData(input);
  const response = await fetch('http://localhost:3000/api/ai/listing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productName: input.productName,
      category: input.category,
      keywords: input.keywords,
      purchasePrice: input.purchasePrice,
      vatPercent: input.vatPercent,
      targetMargin: input.desiredMarginPercent,
      quantity: input.quantity,
      packagingCost: input.packagingCost,
      deliveryCost: input.deliveryCost,
      adsCost: input.adsCost,
      marketAvgPrice: readNumber(input.marketAvgPrice),
      marketRecommendation: input.marketRecommendation || '',
      marketNotes: input.marketNotes,
      marketData,
    }),
  });
  const body = await response.text();
  let data;

  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error('AI service returned invalid JSON. Try again or check backend logs.');
  }

  if (!response.ok) {
    throw new Error(data?.message || 'AI service unavailable. Check backend and OPENAI_API_KEY.');
  }

  return data;
}

async function generateListing() {
  hideMessage();
  const input = getFormData();
  if (!input.productName) {
    showMessage('Wpisz nazwe towaru przed generowaniem listingu.', 'error');
    return null;
  }

  setGenerating(true);

  try {
    const aiData = await requestAiListing(input);
    const listing = buildListing(input, aiData);
    renderListing(listing);
    return listing;
  } catch (error) {
    showMessage(error.message || 'AI service unavailable. Check backend and OPENAI_API_KEY.', 'error');
    return null;
  } finally {
    setGenerating(false);
  }
}

async function saveCurrentIdea() {
  const listing = currentListing || (await generateListing());
  if (!listing) return;
  const ideas = getIdeas();
  setIdeas([listing, ...ideas]);
  renderIdeas();
  showMessage('Pomysl zapisany lokalnie w przegladarce.');
}

function useBestMarketData() {
  hideMarketMessage();
  const input = getFormData();
  if (!input.productName && !input.keywords) {
    showMarketMessage('Wpisz nazwe towaru albo slowa kluczowe, aby dobrac dane rynkowe.', 'error');
    return;
  }

  const row = findBestMarketData(input);
  if (!row) {
    showMarketMessage('Brak market data w localStorage. Zaimportuj CSV w Product Hunter albo Market Data Collector.', 'error');
    return;
  }

  fillMarketFields(row);
  showMarketMessage(`Uzyto market data: ${row.name || 'bez nazwy'} (${row.source}).`);
}

function deleteIdea(id) {
  setIdeas(getIdeas().filter((idea) => idea.id !== id));
  renderIdeas();
}

function selectMarketProduct(id) {
  const idea = getIdeas().find((item) => item.id === id);
  if (!idea) return;

  localStorage.setItem(
    SELECTED_MARKET_PRODUCT_KEY,
    JSON.stringify({
      sku: idea.sku || '',
      name: idea.name || idea.productName || '',
      category: idea.category || '',
      imageUrl: idea.imageUrl || '',
      supplierUrl: idea.supplierUrl || '',
      productId: idea.productId || idea.allegroProductId || '',
    }),
  );

  window.location.href = 'product-hunter.html#market-import';
}

function renderIdeas() {
  const ideas = getIdeas();
  ideasBody.innerHTML = ideas.length
    ? ideas
        .map(
          (idea) => `
            <tr>
              <td>${escapeHtml(idea.sku)}</td>
              <td class="product-name">${escapeHtml(idea.name)}</td>
              <td>${escapeHtml(formatMoney(idea.price))}</td>
              <td>${escapeHtml(idea.quantity)}</td>
              <td class="profit-cell">${escapeHtml(formatMoney(idea.profit))}</td>
              <td>${escapeHtml(formatPercent(idea.roi))}%</td>
              <td>${escapeHtml(formatPercent(idea.margin))}%</td>
              <td><span class="score-pill ${idea.score >= 80 ? 'score-green' : idea.score >= 60 ? 'score-blue' : idea.score >= 40 ? 'score-yellow' : 'score-red'}">${escapeHtml(idea.score)}</span></td>
              <td><span class="recommendation">${escapeHtml(idea.recommendation)}</span></td>
              <td>${idea.marketAvgPrice ? escapeHtml(formatMoney(idea.marketAvgPrice)) : '-'}</td>
              <td>${idea.sellerCount ?? '-'}</td>
              <td>${idea.opportunityScore ?? idea.marketOpportunityScore ?? '-'}</td>
              <td>${idea.marketRecommendation ? `<span class="recommendation">${escapeHtml(idea.marketRecommendation)}</span>` : '-'}</td>
              <td class="action-cell">
                <button type="button" class="secondary-button market-data-button" onclick="openMarketDataForSku('${escapeHtml(idea.sku || '')}')">Uzupelnij dane rynkowe</button>
                <a class="secondary-button test-market-link" href="product-hunter.html#market-import">TEST Market Import</a>
                <button class="delete-button" type="button" data-id="${escapeHtml(idea.id)}">Usun</button>
              </td>
            </tr>
          `,
        )
        .join('')
    : '<tr><td colspan="14">Brak zapisanych pomyslow.</td></tr>';
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function listingToCsvRow(listing) {
  return [
    listing.sku,
    listing.name,
    listing.price.toFixed(2),
    listing.quantity,
    listing.description,
    listing.shortDescription,
    listing.category,
    listing.imageUrl,
    listing.keywords,
    listing.supplierUrl,
    listing.purchasePrice.toFixed(2),
    listing.profit.toFixed(2),
    listing.roi.toFixed(2),
    listing.margin.toFixed(2),
    listing.score,
    listing.recommendation,
  ]
    .map(csvCell)
    .join(',');
}

function exportCsv(type) {
  const ideas = getIdeas();
  const rows = ideas.length ? ideas : currentListing ? [currentListing] : [];
  if (!rows.length) {
    showMessage('Najpierw wygeneruj albo zapisz pomysl produktu.', 'error');
    return;
  }

  const header = 'sku,name,price,quantity,description,short_description,category,image_url,keywords,supplier_url,purchase_price,profit,roi,margin,score,recommendation';
  const csv = [header, ...rows.map(listingToCsvRow)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `allegro-profit-ai-${type}-export.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage(`Eksport CSV ${type} gotowy.`);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isGenerating) return;
  await generateListing();
});

generateButton.addEventListener('click', async () => {
  if (isGenerating) return;
  await generateListing();
});
useMarketDataButton.addEventListener('click', useBestMarketData);
saveButton.addEventListener('click', async () => {
  if (isGenerating) return;
  await saveCurrentIdea();
});
exportBaseLinkerButton.addEventListener('click', () => exportCsv('baselinker'));
exportAllegroButton.addEventListener('click', () => exportCsv('allegro'));
ideasBody.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.delete-button');
  if (!deleteButton) return;
  deleteIdea(deleteButton.dataset.id);
});

document.addEventListener('click', function (event) {
  const btn = event.target.closest('[data-action="market-data"]');
  if (!btn) return;

  const sku = btn.dataset.sku;
  console.log('Market data button clicked', sku);
  const ideas = loadSavedIdeas();
  const idea = ideas.find((item) => item.sku === sku);

  if (!idea) {
    alert('Nie znaleziono produktu.');
    return;
  }

  localStorage.setItem(
    'selectedMarketProduct',
    JSON.stringify({
      sku: idea.sku || '',
      name: idea.name || idea.productName || '',
      category: idea.category || '',
      imageUrl: idea.imageUrl || '',
      supplierUrl: idea.supplierUrl || '',
      productId: idea.productId || idea.allegroProductId || '',
    }),
  );
  window.location.href = 'product-hunter.html#market-import';
});

renderIdeas();
