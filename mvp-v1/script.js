const inputs = {
  purchasePrice: document.querySelector('#purchase-price'),
  salePrice: document.querySelector('#sale-price'),
  deliveryCost: document.querySelector('#delivery-cost'),
  vatRate: document.querySelector('#vat-rate'),
};

const outputs = {
  grossProfit: document.querySelector('#gross-profit'),
  netProfit: document.querySelector('#net-profit'),
  margin: document.querySelector('#margin'),
  vat: document.querySelector('#vat'),
  grossCard: document.querySelector('#gross-card'),
  netCard: document.querySelector('#net-card'),
};

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

function readNumber(input) {
  const value = Number.parseFloat(String(input.value).replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

function setTone(card, value) {
  card.classList.toggle('positive', value >= 0);
  card.classList.toggle('negative', value < 0);
}

function calculate() {
  const purchasePrice = readNumber(inputs.purchasePrice);
  const salePrice = readNumber(inputs.salePrice);
  const deliveryCost = readNumber(inputs.deliveryCost);
  const vatRate = readNumber(inputs.vatRate);

  const grossProfit = salePrice - purchasePrice - deliveryCost;
  const vat = salePrice * (vatRate / (100 + vatRate));
  const netProfit = grossProfit - vat;
  const margin = salePrice > 0 ? netProfit / salePrice : 0;

  outputs.grossProfit.textContent = moneyFormatter.format(grossProfit);
  outputs.netProfit.textContent = moneyFormatter.format(netProfit);
  outputs.margin.textContent = percentFormatter.format(margin);
  outputs.vat.textContent = moneyFormatter.format(vat);

  setTone(outputs.grossCard, grossProfit);
  setTone(outputs.netCard, netProfit);
}

Object.values(inputs).forEach((input) => {
  input.addEventListener('input', calculate);
  input.addEventListener('change', calculate);
  input.addEventListener('keyup', calculate);
});

calculate();
