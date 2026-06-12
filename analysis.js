const form = document.querySelector('#analysis-form');
const offerLink = document.querySelector('#offer-link');
const clearButton = document.querySelector('#clear-button');
const resultPanel = document.querySelector('#result-panel');

const productName = document.querySelector('#product-name');
const scenarioLabel = document.querySelector('#scenario-label');
const salePrice = document.querySelector('#sale-price');
const commission = document.querySelector('#commission');
const deliveryCost = document.querySelector('#delivery-cost');
const estimatedNetProfit = document.querySelector('#estimated-net-profit');
const margin = document.querySelector('#margin');
const roi = document.querySelector('#roi');
const competitionLevel = document.querySelector('#competition-level');
const potentialScore = document.querySelector('#potential-score');
const recommendation = document.querySelector('#recommendation');
const insightCopy = document.querySelector('#insight-copy');
const scoreCard = document.querySelector('#score-card');
const recommendationCard = document.querySelector('#recommendation-card');

const moneyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const scenarios = {
  toy: {
    label: 'Dobry potencjał',
    fallbackName: 'Zabawka edukacyjna premium',
    salePrice: 129.99,
    commission: 13.0,
    deliveryCost: 9.99,
    estimatedNetProfit: 39.5,
    investment: 58,
    competitionLevel: 'Niski',
    potentialScore: 9,
    recommendation: 'Warto testować',
    tone: 'good',
    insight:
      'Segment zabawek wygląda atrakcyjnie: umiarkowany koszt wejścia, dobra marża i niższa konkurencja w tym demo.',
  },
  phone: {
    label: 'Wysoka konkurencja',
    fallbackName: 'Akcesorium telefoniczne',
    salePrice: 89.99,
    commission: 10.8,
    deliveryCost: 8.99,
    estimatedNetProfit: 7.2,
    investment: 48,
    competitionLevel: 'Wysoki',
    potentialScore: 4,
    recommendation: 'Ryzykowne',
    tone: 'warning',
    insight:
      'Produkty telefoniczne mają wysoki poziom konkurencji. Warto testować tylko przy bardzo dobrej cenie zakupu lub przewadze reklamowej.',
  },
  default: {
    label: 'Średni potencjał',
    fallbackName: 'Produkt Allegro',
    salePrice: 149.99,
    commission: 15.0,
    deliveryCost: 11.99,
    estimatedNetProfit: 22.4,
    investment: 82,
    competitionLevel: 'Średni',
    potentialScore: 6,
    recommendation: 'Ryzykowne',
    tone: 'warning',
    insight:
      'Oferta ma średni potencjał. Przed zakupem większej partii sprawdź realny koszt dostawcy, opinie konkurencji i koszt reklam.',
  },
};

function getScenario(link) {
  const normalized = link.toLowerCase();

  if (normalized.includes('toy') || normalized.includes('zabawka')) {
    return scenarios.toy;
  }

  if (normalized.includes('phone') || normalized.includes('telefon')) {
    return scenarios.phone;
  }

  return scenarios.default;
}

function getProductNameFromLink(link, scenario) {
  try {
    const url = new URL(link);
    const parts = url.pathname.split('/').filter(Boolean);
    const offerIndex = parts.indexOf('oferta');
    const slug = offerIndex >= 0 ? parts[offerIndex + 1] : parts[0];

    if (!slug) {
      return scenario.fallbackName;
    }

    const name = slug
      .split('-')
      .filter((part) => Number.isNaN(Number(part)))
      .slice(0, 7)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    return name || scenario.fallbackName;
  } catch {
    return scenario.fallbackName;
  }
}

function setTone(tone) {
  scoreCard.classList.remove('warning', 'danger');
  recommendationCard.classList.remove('good', 'warning', 'danger');

  if (tone === 'warning') {
    scoreCard.classList.add('warning');
    recommendationCard.classList.add('warning');
  } else if (tone === 'danger') {
    scoreCard.classList.add('danger');
    recommendationCard.classList.add('danger');
  } else {
    recommendationCard.classList.add('good');
  }
}

function showResult(link) {
  const scenario = getScenario(link);
  const marginValue = scenario.salePrice > 0 ? scenario.estimatedNetProfit / scenario.salePrice : 0;
  const roiValue = scenario.investment > 0 ? scenario.estimatedNetProfit / scenario.investment : 0;

  productName.textContent = getProductNameFromLink(link, scenario);
  scenarioLabel.textContent = scenario.label;
  salePrice.textContent = moneyFormatter.format(scenario.salePrice);
  commission.textContent = moneyFormatter.format(scenario.commission);
  deliveryCost.textContent = moneyFormatter.format(scenario.deliveryCost);
  estimatedNetProfit.textContent = moneyFormatter.format(scenario.estimatedNetProfit);
  margin.textContent = percentFormatter.format(marginValue);
  roi.textContent = percentFormatter.format(roiValue);
  competitionLevel.textContent = scenario.competitionLevel;
  potentialScore.textContent = `${scenario.potentialScore}/10`;
  recommendation.textContent = scenario.recommendation;
  insightCopy.textContent = scenario.insight;
  setTone(scenario.tone);
  resultPanel.classList.remove('hidden');
}

function clearAnalysis() {
  offerLink.value = '';
  resultPanel.classList.add('hidden');
  offerLink.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  showResult(offerLink.value.trim());
});

clearButton.addEventListener('click', clearAnalysis);
