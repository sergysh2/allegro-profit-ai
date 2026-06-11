const form = document.querySelector('#analysis-form');
const offerLink = document.querySelector('#offer-link');
const resultPanel = document.querySelector('#result-panel');

const productName = document.querySelector('#product-name');
const salePrice = document.querySelector('#sale-price');
const commission = document.querySelector('#commission');
const estimatedProfit = document.querySelector('#estimated-profit');
const competitionLevel = document.querySelector('#competition-level');
const potentialScore = document.querySelector('#potential-score');

function getProductNameFromLink(link) {
  try {
    const url = new URL(link);
    const parts = url.pathname.split('/').filter(Boolean);
    const offerIndex = parts.indexOf('oferta');
    const slug = offerIndex >= 0 ? parts[offerIndex + 1] : parts[0];

    if (!slug) {
      return 'Przykładowy produkt Allegro';
    }

    return slug
      .split('-')
      .filter((part) => Number.isNaN(Number(part)))
      .slice(0, 6)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return 'Przykładowy produkt Allegro';
  }
}

function showMockResult(link) {
  const normalizedLink = link.trim();
  productName.textContent = getProductNameFromLink(normalizedLink);
  salePrice.textContent = '149,99 zł';
  commission.textContent = '15,00 zł';
  estimatedProfit.textContent = '42,50 zł';
  competitionLevel.textContent = 'Średni';
  potentialScore.textContent = '8/10';
  resultPanel.classList.remove('hidden');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  showMockResult(offerLink.value);
});
