const form = document.querySelector('#finder-form');
const realSearchForm = document.querySelector('#real-search-form');
const allegroPhrase = document.querySelector('#allegro-phrase');
const category = document.querySelector('#category');
const priceFrom = document.querySelector('#price-from');
const priceTo = document.querySelector('#price-to');
const minMargin = document.querySelector('#min-margin');
const maxCompetition = document.querySelector('#max-competition');
const resultsPanel = document.querySelector('#results-panel');
const resultsBody = document.querySelector('#results-body');
const resultCount = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const allegroResultsPanel = document.querySelector('#allegro-results-panel');
const allegroResultsBody = document.querySelector('#allegro-results-body');
const allegroResultCount = document.querySelector('#allegro-result-count');
const allegroMessage = document.querySelector('#allegro-message');

const products = [
  {
    product: 'Zestaw kreatywnych klocków',
    category: 'Zabawki',
    purchasePrice: 38,
    salePrice: 89.99,
    netProfit: 24.4,
    margin: 27.11,
    roi: 64.21,
    competition: 'Niska',
    competitionRank: 1,
    potential: 9,
    recommendation: 'Warto testować',
  },
  {
    product: 'Organizer do szuflady premium',
    category: 'Dom i ogród',
    purchasePrice: 18.5,
    salePrice: 49.99,
    netProfit: 13.9,
    margin: 27.81,
    roi: 75.14,
    competition: 'Średnia',
    competitionRank: 2,
    potential: 8,
    recommendation: 'Warto testować',
  },
  {
    product: 'Etui magnetyczne do telefonu',
    category: 'Elektronika',
    purchasePrice: 21,
    salePrice: 44.99,
    netProfit: 5.8,
    margin: 12.89,
    roi: 27.62,
    competition: 'Wysoka',
    competitionRank: 3,
    potential: 4,
    recommendation: 'Ryzykowne',
  },
  {
    product: 'Szczotka do masażu skóry głowy',
    category: 'Beauty',
    purchasePrice: 9.8,
    salePrice: 34.99,
    netProfit: 11.2,
    margin: 32.01,
    roi: 114.29,
    competition: 'Średnia',
    competitionRank: 2,
    potential: 8,
    recommendation: 'Warto testować',
  },
  {
    product: 'Guma treningowa zestaw 5 szt.',
    category: 'Sport',
    purchasePrice: 16,
    salePrice: 39.99,
    netProfit: 9.1,
    margin: 22.76,
    roi: 56.88,
    competition: 'Średnia',
    competitionRank: 2,
    potential: 7,
    recommendation: 'Warto testować',
  },
  {
    product: 'Mini lampka LED USB',
    category: 'Elektronika',
    purchasePrice: 7.5,
    salePrice: 19.99,
    netProfit: 3.1,
    margin: 15.51,
    roi: 41.33,
    competition: 'Wysoka',
    competitionRank: 3,
    potential: 5,
    recommendation: 'Ryzykowne',
  },
  {
    product: 'Pojemnik na karmę 2 kg',
    category: 'Dom i ogród',
    purchasePrice: 24,
    salePrice: 59.99,
    netProfit: 15.7,
    margin: 26.17,
    roi: 65.42,
    competition: 'Niska',
    competitionRank: 1,
    potential: 9,
    recommendation: 'Warto testować',
  },
  {
    product: 'Tani kabel USB-C no-name',
    category: 'Elektronika',
    purchasePrice: 6.2,
    salePrice: 12.99,
    netProfit: -0.6,
    margin: -4.62,
    roi: -9.68,
    competition: 'Wysoka',
    competitionRank: 3,
    potential: 2,
    recommendation: 'Nieopłacalne',
  },
];

const moneyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function readNumber(input, fallback) {
  const value = Number.parseFloat(String(input.value).replace(',', '.'));
  return Number.isFinite(value) ? value : fallback;
}

function recommendationTone(recommendation) {
  if (recommendation === 'Warto testować') {
    return 'good';
  }

  if (recommendation === 'Nieopłacalne') {
    return 'danger';
  }

  return 'warning';
}

function renderRows(items) {
  resultsBody.innerHTML = items
    .map((item) => {
      const tone = recommendationTone(item.recommendation);

      return `
        <tr>
          <td class="product-name">${item.product}</td>
          <td>${item.category}</td>
          <td>${moneyFormatter.format(item.purchasePrice)}</td>
          <td>${moneyFormatter.format(item.salePrice)}</td>
          <td class="money-positive">${moneyFormatter.format(item.netProfit)}</td>
          <td>${percentFormatter.format(item.margin)}%</td>
          <td>${percentFormatter.format(item.roi)}%</td>
          <td>${item.competition}</td>
          <td>${item.potential}/10</td>
          <td><span class="badge ${tone}">${item.recommendation}</span></td>
        </tr>
      `;
    })
    .join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getOffersFromAllegroResponse(data) {
  const promoted = data?.items?.promoted || [];
  const regular = data?.items?.regular || [];

  if (Array.isArray(data?.offers)) {
    return data.offers;
  }

  return [...promoted, ...regular];
}

function getOfferPrice(offer) {
  return offer?.sellingMode?.price || offer?.price || {};
}

function getOfferLink(offer) {
  if (offer?.url) {
    return offer.url;
  }

  if (offer?.external?.url) {
    return offer.external.url;
  }

  if (offer?.id) {
    return `https://allegro.pl/oferta/${offer.id}`;
  }

  return '';
}

function showAllegroMessage(message, type = 'info') {
  allegroMessage.textContent = message;
  allegroMessage.classList.toggle('error', type === 'error');
  allegroMessage.classList.remove('hidden');
}

function clearAllegroMessage() {
  allegroMessage.textContent = '';
  allegroMessage.classList.remove('error');
  allegroMessage.classList.add('hidden');
}

function renderAllegroRows(offers) {
  allegroResultsBody.innerHTML = offers
    .map((offer) => {
      const price = getOfferPrice(offer);
      const link = getOfferLink(offer);

      return `
        <tr>
          <td class="product-name">${escapeHtml(offer.name || 'Brak nazwy')}</td>
          <td>${escapeHtml(price.amount || '-')}</td>
          <td>${escapeHtml(price.currency || '-')}</td>
          <td>${escapeHtml(offer.id || '-')}</td>
          <td>${
            link
              ? `<a class="offer-link" href="${escapeHtml(link)}" target="_blank" rel="noreferrer">Otwórz</a>`
              : '-'
          }</td>
          <td><span class="badge good">OK</span></td>
        </tr>
      `;
    })
    .join('');
}

function renderAllegroError(status, message) {
  allegroResultsBody.innerHTML = `
    <tr>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
      <td><span class="badge danger">${escapeHtml(status)}</span> ${escapeHtml(message)}</td>
    </tr>
  `;
  allegroResultCount.textContent = '0';
  allegroResultsPanel.classList.remove('hidden');
}

async function searchAllegro() {
  const phrase = allegroPhrase.value.trim();

  clearAllegroMessage();
  allegroResultsPanel.classList.remove('hidden');
  allegroResultCount.textContent = '0';
  allegroResultsBody.innerHTML = '';

  if (!phrase) {
    showAllegroMessage('Wpisz frazę wyszukiwania Allegro.', 'error');
    renderAllegroError('Brak frazy', 'Nie można wyszukać pustej frazy.');
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/allegro/search?phrase=${encodeURIComponent(phrase)}`);
    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || 'Nie udało się pobrać wyników z Allegro API.';
      const authError = response.status === 401 || data?.error === 'not_authenticated';

      showAllegroMessage(
        authError
          ? 'Najpierw połącz konto Allegro przez backend OAuth.'
          : `Allegro API zwróciło błąd: ${errorMessage}`,
        'error',
      );
      renderAllegroError(`HTTP ${response.status}`, errorMessage);
      return;
    }

    const offers = getOffersFromAllegroResponse(data);
    renderAllegroRows(offers);
    allegroResultCount.textContent = String(offers.length);

    if (offers.length === 0) {
      showAllegroMessage('Allegro API nie zwróciło ofert dla tej frazy.');
    }
  } catch (error) {
    showAllegroMessage('Najpierw połącz konto Allegro przez backend OAuth.', 'error');
    renderAllegroError('Backend offline', error.message);
  }
}

function searchOpportunities() {
  const selectedCategory = category.value;
  const from = readNumber(priceFrom, 0);
  const to = readNumber(priceTo, Number.POSITIVE_INFINITY);
  const marginLimit = readNumber(minMargin, 0);
  const competitionLimit = readNumber(maxCompetition, 3);

  const filtered = products
    .filter((item) => selectedCategory === 'all' || item.category === selectedCategory)
    .filter((item) => item.purchasePrice >= from)
    .filter((item) => item.purchasePrice <= to)
    .filter((item) => item.margin >= marginLimit)
    .filter((item) => item.competitionRank <= competitionLimit)
    .sort((a, b) => b.potential - a.potential || b.roi - a.roi);

  renderRows(filtered);
  resultCount.textContent = String(filtered.length);
  emptyState.classList.toggle('hidden', filtered.length > 0);
  resultsPanel.classList.remove('hidden');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  searchOpportunities();
});

realSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await searchAllegro();
});
