const ALLEGRO_API_BASE = 'http://localhost:3000/api/allegro';

function liveReadNumber(value) {
  const number = Number.parseFloat(String(value || '0').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function liveNormalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function liveNameSimilarity(left, right) {
  const leftWords = new Set(liveNormalizeText(left).split(' ').filter((word) => word.length > 2));
  const rightWords = new Set(liveNormalizeText(right).split(' ').filter((word) => word.length > 2));
  if (!leftWords.size || !rightWords.size) return 0;
  const common = [...leftWords].filter((word) => rightWords.has(word)).length;
  return common / Math.max(leftWords.size, rightWords.size);
}

async function liveFetchJson(path) {
  const response = await fetch(`${ALLEGRO_API_BASE}${path}`);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function getLiveOffers(data) {
  if (Array.isArray(data?.offers)) return data.offers;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function getLiveOrders(data) {
  if (Array.isArray(data?.checkoutForms)) return data.checkoutForms;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data)) return data;
  return [];
}

function getLiveOfferPrice(offer) {
  return offer?.sellingMode?.price || offer?.price || {};
}

function getLiveOfferPhoto(offer) {
  return offer?.primaryImage?.url || offer?.primaryImage || offer?.images?.[0]?.url || offer?.images?.[0] || '';
}

function normalizeLiveOffer(offer) {
  const price = getLiveOfferPrice(offer);
  return {
    id: offer?.id || '-',
    name: offer?.name || 'Bez nazwy',
    photo: getLiveOfferPhoto(offer),
    amount: liveReadNumber(price?.amount),
    currency: price?.currency || 'PLN',
    status: offer?.publication?.status || offer?.status || '-',
    marketplace: offer?.publication?.marketplace || offer?.publication?.marketplaceId || offer?.marketplace?.id || '-',
    startedAt: offer?.publication?.startedAt || offer?.createdAt || offer?.updatedAt || '',
    stock: Number(offer?.stock?.available ?? offer?.quantity ?? 0),
    quantity: Number(offer?.stock?.available ?? offer?.quantity ?? 0),
    sku: offer?.external?.id || '-',
    link: offer?.publication?.link || offer?.url || offer?.id || '-',
    raw: offer,
  };
}

function getLiveOrderAmount(order) {
  return order?.payment?.paidAmount || order?.summary?.totalToPay || order?.summary?.totalPaid || order?.payment?.amount || {};
}

function getLiveOrderLineItems(order) {
  return Array.isArray(order?.lineItems) ? order.lineItems : [];
}

function getLiveBuyerAddress(order) {
  return order?.delivery?.address || order?.invoice?.address || order?.buyer?.address || {};
}

function normalizeLiveOrder(order) {
  const amount = getLiveOrderAmount(order);
  const address = getLiveBuyerAddress(order);
  return {
    id: order?.id || '-',
    buyerLogin: order?.buyer?.login || '-',
    buyerEmail: order?.buyer?.email || '-',
    phone: order?.buyer?.phoneNumber || order?.delivery?.address?.phoneNumber || order?.invoice?.address?.phoneNumber || '-',
    city: address?.city || '-',
    amount: liveReadNumber(amount?.amount),
    currency: amount?.currency || 'PLN',
    paymentStatus: order?.payment?.status || '-',
    createdAt: order?.boughtAt || order?.createdAt || order?.updatedAt || '',
    finishedAt: order?.payment?.finishedAt || order?.finishedAt || '',
    itemsCount: getLiveOrderLineItems(order).reduce((sum, item) => sum + Number(item?.quantity || 1), 0),
    lineItems: getLiveOrderLineItems(order),
    raw: order,
  };
}

function calculateOrdersSummary(orders) {
  const normalized = orders.map((order) => (order.lineItems ? order : normalizeLiveOrder(order)));
  const totalRevenue = normalized.reduce((sum, order) => sum + order.amount, 0);
  const currency = normalized.find((order) => order.currency)?.currency || 'PLN';
  return {
    totalOrders: normalized.length,
    totalRevenue,
    currency,
    averageOrderValue: normalized.length ? totalRevenue / normalized.length : 0,
  };
}

function findMatchingOffer(offers, productName) {
  return offers
    .map((offer) => ({
      offer,
      score: liveNameSimilarity(productName, offer.name || offer.raw?.name),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.offer || null;
}

function findMatchingOrders(orders, productName) {
  const normalizedName = liveNormalizeText(productName);
  if (!normalizedName) return [];
  return orders.filter((order) =>
    getLiveOrderLineItems(order.raw || order).some((item) => liveNameSimilarity(normalizedName, item?.offer?.name || '') > 0),
  );
}

async function loadAllegroMe() {
  return liveFetchJson('/me');
}

async function loadAllegroOffers() {
  const data = await liveFetchJson('/offers');
  return getLiveOffers(data).map(normalizeLiveOffer);
}

async function loadAllegroOrders() {
  const data = await liveFetchJson('/orders');
  return getLiveOrders(data).map(normalizeLiveOrder);
}

window.AllegroLive = {
  loadAllegroMe,
  loadAllegroOffers,
  loadAllegroOrders,
  calculateOrdersSummary,
  findMatchingOffer,
  findMatchingOrders,
  normalizeOffer: normalizeLiveOffer,
  normalizeOrder: normalizeLiveOrder,
  isAuthError(error) {
    return error?.status === 401 || error?.data?.error === 'not_authenticated';
  },
};
