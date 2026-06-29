const form = document.querySelector('#listing-form');
const generateButton = document.querySelector('#generate-listing');
const saveButton = document.querySelector('#save-idea');
const exportBaseLinkerButton = document.querySelector('#export-baselinker');
const exportAllegroButton = document.querySelector('#export-allegro');
const ideasBody = document.querySelector('#ideas-body');
const messageEl = document.querySelector('#studio-message');

const resultEls = {
  name: document.querySelector('#result-name'),
  sku: document.querySelector('#result-sku'),
  price: document.querySelector('#result-price'),
  profit: document.querySelector('#result-profit'),
  roi: document.querySelector('#result-roi'),
  margin: document.querySelector('#result-margin'),
  score: document.querySelector('#result-score'),
  recommendation: document.querySelector('#result-recommendation'),
  short: document.querySelector('#result-short'),
  bullets: document.querySelector('#result-bullets'),
  long: document.querySelector('#result-long'),
};

const STORAGE_KEY = 'listing-studio:ideas';
const SELECTED_MARKET_PRODUCT_KEY = 'selectedMarketProduct';
let currentListing = null;

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

function getFormData() {
  const data = new FormData(form);
  return {
    supplierUrl: String(data.get('supplierUrl') || '').trim(),
    productName: String(data.get('productName') || '').trim(),
    purchasePrice: readNumber(data.get('purchasePrice')),
    deliveryCost: readNumber(data.get('deliveryCost')),
    packagingCost: readNumber(data.get('packagingCost')),
    commissionPercent: readNumber(data.get('commissionPercent')),
    vatPercent: readNumber(data.get('vatPercent')),
    desiredMarginPercent: readNumber(data.get('desiredMarginPercent')),
    imageUrl: String(data.get('imageUrl') || '').trim(),
    category: String(data.get('category') || '').trim(),
    keywords: String(data.get('keywords') || '').trim(),
    quantity: Math.max(0, Math.round(readNumber(data.get('quantity')))),
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

function buildListing(input) {
  const productName = input.productName || 'Nowy produkt';
  const cleanCategory = input.category || 'Allegro';
  const keywords = input.keywords
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const totalCost = input.purchasePrice + input.deliveryCost + input.packagingCost;
  const marginDivider = Math.max(0.05, 1 - input.desiredMarginPercent / 100);
  const targetPrice = totalCost / marginDivider;
  const allegroFee = (targetPrice * input.commissionPercent) / 100;
  const vatCost = (targetPrice * input.vatPercent) / 100;
  const netProfit = targetPrice - totalCost - allegroFee - vatCost;
  const roi = input.purchasePrice > 0 ? (netProfit / input.purchasePrice) * 100 : 0;
  const margin = targetPrice > 0 ? (netProfit / targetPrice) * 100 : 0;
  const score = calculateScore(input, margin, roi);
  const recommendation = getRecommendation(score, netProfit, margin);
  const sku = `${slug(productName)}-${Date.now().toString().slice(-5)}`;
  const allegroName = `${productName} | ${cleanCategory} | szybka wysylka`;
  const keywordText = keywords.length ? keywords.join(', ') : 'praktyczny produkt do codziennego uzytku';
  const bullets = [
    `Kategoria: ${cleanCategory}`,
    `Najwazniejsze slowa kluczowe: ${keywordText}`,
    `Ilosc startowa: ${input.quantity} szt.`,
    `Cena rekomendowana: ${formatMoney(targetPrice)}`,
  ];
  const shortDescription = `${productName} to propozycja do sprzedazy na Allegro w kategorii ${cleanCategory}. Listing zostal przygotowany pod szybki test rentownosci.`;
  const longDescription = `Produkt ${productName} zostal przygotowany do wystawienia na Allegro. Opis podkresla praktyczne zastosowanie, czytelna kategorie oraz slowa kluczowe: ${keywordText}. Rekomendowana cena uwzglednia koszt zakupu, dostawe, pakowanie, prowizje Allegro i VAT.`;

  return {
    id: crypto.randomUUID(),
    supplierUrl: input.supplierUrl,
    productName,
    name: allegroName,
    purchasePrice: input.purchasePrice,
    deliveryCost: input.deliveryCost,
    packagingCost: input.packagingCost,
    commissionPercent: input.commissionPercent,
    vatPercent: input.vatPercent,
    desiredMarginPercent: input.desiredMarginPercent,
    imageUrl: input.imageUrl,
    category: cleanCategory,
    keywords: input.keywords,
    quantity: input.quantity,
    sku,
    price: targetPrice,
    totalCost,
    allegroFee,
    vatCost,
    profit: netProfit,
    roi,
    margin,
    score,
    recommendation,
    shortDescription,
    description: longDescription,
    bullets,
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
  resultEls.recommendation.textContent = listing.recommendation;
  resultEls.short.textContent = listing.shortDescription;
  resultEls.long.textContent = listing.description;
  resultEls.bullets.innerHTML = listing.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function generateListing() {
  hideMessage();
  const input = getFormData();
  if (!input.productName) {
    showMessage('Wpisz nazwe towaru przed generowaniem listingu.', 'error');
    return null;
  }
  const listing = buildListing(input);
  renderListing(listing);
  return listing;
}

function saveCurrentIdea() {
  const listing = currentListing || generateListing();
  if (!listing) return;
  const ideas = getIdeas();
  setIdeas([listing, ...ideas]);
  renderIdeas();
  showMessage('Pomysl zapisany lokalnie w przegladarce.');
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  generateListing();
});

generateButton.addEventListener('click', generateListing);
saveButton.addEventListener('click', saveCurrentIdea);
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
