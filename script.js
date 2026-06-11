const inputs = {
  purchasePrice: document.querySelector('#purchase-price'),
  salePrice: document.querySelector('#sale-price'),
  deliveryCost: document.querySelector('#delivery-cost'),
  packingCost: document.querySelector('#packing-cost'),
  vatRate: document.querySelector('#vat-rate'),
  allegroCommissionRate: document.querySelector('#allegro-commission-rate'),
  adsRate: document.querySelector('#ads-rate'),
  freeDelivery: document.querySelectorAll('input[name="free-delivery"]'),
};

const outputs = {
  revenue: document.querySelector('#revenue'),
  revenueDetail: document.querySelector('#revenue-detail'),
  totalCosts: document.querySelector('#total-costs'),
  totalCostsDetail: document.querySelector('#total-costs-detail'),
  allegroCommission: document.querySelector('#allegro-commission'),
  adsCost: document.querySelector('#ads-cost'),
  vat: document.querySelector('#vat'),
  finalNetProfit: document.querySelector('#final-net-profit'),
  finalNetProfitDetail: document.querySelector('#final-net-profit-detail'),
  finalCard: document.querySelector('#final-card'),
  finalDetailCard: document.querySelector('#final-detail-card'),
};

const moneyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
});

function readNumber(input) {
  const value = Number.parseFloat(String(input.value).replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

function isFreeDelivery() {
  const selected = document.querySelector('input[name="free-delivery"]:checked');
  return selected?.value === 'yes';
}

function setTone(card, value) {
  card.classList.toggle('positive', value >= 0);
  card.classList.toggle('negative', value < 0);
}

function setMoney(element, value) {
  element.textContent = moneyFormatter.format(value);
}

function calculate() {
  const purchasePrice = readNumber(inputs.purchasePrice);
  const salePrice = readNumber(inputs.salePrice);
  const deliveryCost = readNumber(inputs.deliveryCost);
  const packingCost = readNumber(inputs.packingCost);
  const vatRate = readNumber(inputs.vatRate);
  const allegroCommissionRate = readNumber(inputs.allegroCommissionRate);
  const adsRate = readNumber(inputs.adsRate);

  const revenue = salePrice;
  const vat = revenue * (vatRate / (100 + vatRate));
  const allegroCommission = revenue * (allegroCommissionRate / 100);
  const adsCost = revenue * (adsRate / 100);
  const deliveryPaidBySeller = isFreeDelivery() ? deliveryCost : 0;
  const totalCosts = purchasePrice + packingCost + deliveryPaidBySeller + allegroCommission + adsCost + vat;
  const finalNetProfit = revenue - totalCosts;

  setMoney(outputs.revenue, revenue);
  setMoney(outputs.revenueDetail, revenue);
  setMoney(outputs.totalCosts, totalCosts);
  setMoney(outputs.totalCostsDetail, totalCosts);
  setMoney(outputs.allegroCommission, allegroCommission);
  setMoney(outputs.adsCost, adsCost);
  setMoney(outputs.vat, vat);
  setMoney(outputs.finalNetProfit, finalNetProfit);
  setMoney(outputs.finalNetProfitDetail, finalNetProfit);

  setTone(outputs.finalCard, finalNetProfit);
  setTone(outputs.finalDetailCard, finalNetProfit);
}

[
  inputs.purchasePrice,
  inputs.salePrice,
  inputs.deliveryCost,
  inputs.packingCost,
  inputs.vatRate,
  inputs.allegroCommissionRate,
  inputs.adsRate,
  ...inputs.freeDelivery,
].forEach((input) => {
  input.addEventListener('input', calculate);
  input.addEventListener('change', calculate);
  input.addEventListener('keyup', calculate);
});

calculate();
