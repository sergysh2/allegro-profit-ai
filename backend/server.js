import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';

const ALLEGRO_AUTH_URL = 'https://allegro.pl/auth/oauth/authorize';
const ALLEGRO_TOKEN_URL = 'https://allegro.pl/auth/oauth/token';
const ALLEGRO_API_URL = 'https://api.allegro.pl';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const APP_USER_AGENT = 'AllegroProfitAI/12.2 (+http://localhost:3000)';
const ALLEGRO_SCOPES = [
  'allegro:api:sale:offers:read',
  'allegro:api:orders:read',
  'allegro:api:profile:read',
].join(' ');

let tokenState = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

let appTokenState = {
  accessToken: null,
  expiresAt: null,
};

function loadEnv() {
  const envPath = new URL('.env', import.meta.url);

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getConfig() {
  return {
    clientId: process.env.ALLEGRO_CLIENT_ID || '',
    clientSecret: process.env.ALLEGRO_CLIENT_SECRET || '',
    redirectUri: process.env.ALLEGRO_REDIRECT_URI || 'http://localhost:3000/api/allegro/callback',
    openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
    openaiModel: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini',
    port: Number(process.env.PORT || 3000),
  };
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(data, null, 2));
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function requireConfig(response, config) {
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    sendJson(response, 500, {
      error: 'missing_allegro_config',
      message: 'Set ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET and ALLEGRO_REDIRECT_URI in backend/.env.',
    });
    return false;
  }

  return true;
}

function getBasicAuth(config) {
  return Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });

    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function readJsonBody(request) {
  const body = await readRequestBody(request);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

async function exchangeCodeForToken(code, config) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(ALLEGRO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${getBasicAuth(config)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  tokenState = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data;
}

async function getApplicationToken(config) {
  if (appTokenState.accessToken && appTokenState.expiresAt && appTokenState.expiresAt > Date.now()) {
    return appTokenState.accessToken;
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'client_credentials',
  });

  const response = await fetch(ALLEGRO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${getBasicAuth(config)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': APP_USER_AGENT,
    },
    body: tokenBody,
  });

  const responseBody = await response.text();
  console.log('[Allegro app token] status', response.status);

  let data;

  try {
    data = responseBody ? JSON.parse(responseBody) : null;
  } catch {
    data = {
      raw: responseBody,
    };
  }

  if (!response.ok) {
    console.log('[Allegro app token] body', responseBody);
    throw new Error(JSON.stringify(data));
  }

  appTokenState = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return appTokenState.accessToken;
}

async function executeAllegroRequest(path, accessToken, context = 'Allegro API') {
  const fullUrl = `${ALLEGRO_API_URL}${path}`;
  const method = 'GET';
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.allegro.public.v1+json',
    'Content-Type': 'application/json',
    'User-Agent': APP_USER_AGENT,
  };

  console.log(`[${context}] request url`, fullUrl);
  console.log(`[${context}] request method`, method);
  console.log(`[${context}] request headers`, {
    ...headers,
    Authorization: accessToken ? 'Bearer <redacted>' : '',
  });

  const response = await fetch(fullUrl, {
    method,
    headers,
  });
  const body = await response.text();
  let data;

  try {
    data = body ? JSON.parse(body) : null;
  } catch {
    data = {
      raw: body,
    };
  }

  console.log('[Allegro API] status', response.status);
  console.log('[Allegro API] body', body);

  if (response.status === 401) {
    tokenState = {
      accessToken: null,
      refreshToken: tokenState.refreshToken,
      expiresAt: null,
    };

    return {
      statusCode: 401,
      data: {
        error: 'not_authenticated',
        message: 'Allegro OAuth token is missing or expired. Open /api/allegro/login and authorize the app again.',
        allegro: {
          status: response.status,
          statusText: response.statusText,
          body: data,
          rawBody: body,
          path,
          request: {
            url: fullUrl,
            method,
            headers: {
              ...headers,
              Authorization: accessToken ? 'Bearer <redacted>' : '',
            },
          },
        },
      },
    };
  }

  if (!response.ok) {
    return {
      statusCode: response.status,
      data: {
        error: 'allegro_api_error',
        message: data?.message || data?.error_description || data?.error || response.statusText || 'Allegro API returned an error.',
        allegro: {
          status: response.status,
          statusText: response.statusText,
          body: data,
          rawBody: body,
          path,
          request: {
            url: fullUrl,
            method,
            headers: {
              ...headers,
              Authorization: accessToken ? 'Bearer <redacted>' : '',
            },
          },
        },
      },
    };
  }

  return {
    statusCode: response.status,
    data,
  };
}

async function callAllegro(path) {
  if (!tokenState.accessToken) {
    return {
      statusCode: 401,
      data: {
        error: 'not_authenticated',
        message: 'Open /api/allegro/login first and authorize the app.',
      },
    };
  }

  if (tokenState.expiresAt && tokenState.expiresAt <= Date.now()) {
    tokenState = {
      accessToken: null,
      refreshToken: tokenState.refreshToken,
      expiresAt: null,
    };

    return {
      statusCode: 401,
      data: {
        error: 'not_authenticated',
        message: 'OAuth token expired. Open /api/allegro/login and authorize the app again.',
      },
    };
  }

  return executeAllegroRequest(path, tokenState.accessToken, 'Allegro seller API');
}

async function callAllegroPublic(path, config) {
  const accessToken = await getApplicationToken(config);
  return executeAllegroRequest(path, accessToken, 'Allegro public search API');
}

function normalizeOffer(offer) {
  const sellingMode = offer?.sellingMode || {};
  const price = sellingMode?.price || offer?.price || {};

  return {
    id: offer?.id || null,
    name: offer?.name || null,
    primaryImage: offer?.primaryImage || offer?.images?.[0] || null,
    sellingMode: {
      ...sellingMode,
      price: {
        amount: price?.amount || null,
        currency: price?.currency || null,
      },
    },
    publication: {
      ...(offer?.publication || {}),
      status: offer?.publication?.status || offer?.status || null,
    },
    stock: {
      ...(offer?.stock || {}),
      available: offer?.stock?.available ?? null,
    },
    external: offer?.external?.id
      ? {
          id: offer.external.id,
        }
      : null,
    stats: offer?.stats || null,
  };
}

function normalizeCategoryPath(category) {
  const path = category?.path;
  if (!Array.isArray(path)) return [];
  return path
    .map((item) => ({
      id: item?.id || null,
      name: item?.name || null,
    }))
    .filter((item) => item.id || item.name);
}

function normalizeProduct(product) {
  const images = Array.isArray(product?.images) ? product.images : [];
  return {
    id: product?.id || null,
    name: product?.name || null,
    categoryId: product?.category?.id || null,
    categoryPath: normalizeCategoryPath(product?.category),
    image: images[0]?.url || images[0] || null,
    images,
    publicationStatus: product?.publication?.status || product?.publicationStatus || null,
    source: 'Allegro /sale/products',
  };
}

async function searchAllegroProducts(phrase) {
  const result = await callAllegro(`/sale/products?phrase=${encodeURIComponent(phrase)}&language=pl-PL`);

  if (result.statusCode < 200 || result.statusCode >= 300) {
    return result;
  }

  const products = Array.isArray(result.data?.products) ? result.data.products.map(normalizeProduct) : [];
  return {
    statusCode: result.statusCode,
    data: {
      products,
      count: products.length,
      source: 'Allegro /sale/products',
      note: 'Allegro product catalog does not provide market price data.',
      rawTotalCount: result.data?.totalCount ?? result.data?.count ?? products.length,
    },
  };
}

function getOrderTotal(order) {
  const total = order?.summary?.totalToPay || order?.payment?.paidAmount || order?.payment?.amount || {};
  return {
    amount: Number(total?.amount || 0),
    currency: total?.currency || 'PLN',
  };
}

function getLineItemPrice(lineItem) {
  const price = lineItem?.price || lineItem?.offer?.price || {};
  return Number(price?.amount || 0);
}

function summarizeOrders(orders) {
  const productMap = new Map();
  let totalRevenue = 0;
  let currency = 'PLN';

  for (const order of orders) {
    const total = getOrderTotal(order);
    totalRevenue += total.amount;
    currency = total.currency || currency;

    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    for (const lineItem of lineItems) {
      const name = lineItem?.offer?.name || lineItem?.offer?.external?.id || 'Unknown product';
      const quantity = Number(lineItem?.quantity || 0);
      const lineRevenue = getLineItemPrice(lineItem) * quantity;
      const current = productMap.get(name) || {
        productName: name,
        soldQuantity: 0,
        revenue: 0,
        averageSalePrice: 0,
      };
      current.soldQuantity += quantity;
      current.revenue += lineRevenue;
      current.averageSalePrice = current.soldQuantity > 0 ? current.revenue / current.soldQuantity : 0;
      productMap.set(name, current);
    }
  }

  const soldQuantityByProductName = [...productMap.values()].sort((a, b) => b.soldQuantity - a.soldQuantity);

  return {
    totalOrders: orders.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    currency,
    averageOrderValue: orders.length ? Number((totalRevenue / orders.length).toFixed(2)) : 0,
    soldQuantityByProductName: soldQuantityByProductName.map((item) => ({
      ...item,
      revenue: Number(item.revenue.toFixed(2)),
      averageSalePrice: Number(item.averageSalePrice.toFixed(2)),
    })),
  };
}

async function getOrdersSummary() {
  const result = await callAllegro('/order/checkout-forms');

  if (result.statusCode < 200 || result.statusCode >= 300) {
    return result;
  }

  const orders = Array.isArray(result.data?.checkoutForms) ? result.data.checkoutForms : [];
  return {
    statusCode: result.statusCode,
    data: summarizeOrders(orders),
  };
}

async function getSellerOffers() {
  const result = await callAllegro('/sale/offers?limit=100&offset=0');

  if (result.statusCode < 200 || result.statusCode >= 300) {
    console.error('[Allegro offers] API error', {
      statusCode: result.statusCode,
      error: result.data?.error,
      message: result.data?.message,
    });
    return result;
  }

  const offers = Array.isArray(result.data?.offers) ? result.data.offers : [];
  const normalizedOffers = offers.map(normalizeOffer);

  console.log('[Allegro offers] fetched offers', {
    count: normalizedOffers.length,
    totalCount: result.data?.totalCount ?? result.data?.count ?? normalizedOffers.length,
  });

  return {
    statusCode: result.statusCode,
    data: {
      offers: normalizedOffers,
      count: normalizedOffers.length,
      totalCount: result.data?.totalCount ?? result.data?.count ?? normalizedOffers.length,
    },
  };
}

function getAiSystemPrompt() {
  return [
    'Jestes asystentem Allegro Profit AI.',
    'Generujesz wysokiej jakosci listing po polsku dla sprzedawcy Allegro.',
    'Styl ma byc profesjonalny, sprzedazowy i konkretny, ale bez obietnic, ktorych nie da sie udowodnic.',
    'Uwzgledniasz nazwe produktu, cene zakupu, VAT, docelowa marze, kategorie, slowa kluczowe, ilosc, koszt pakowania, koszt dostawy i reklame.',
    'Nie wymyslaj certyfikatow, gwarancji, materialow, parametrow technicznych ani zgodnosci, jesli nie wynikaja z danych wejsciowych.',
    'Jesli marketData jest dostepne, wszystkie pola marketInsight musza wynikac wylacznie z marketData.',
    'productCatalogData z Allegro /sale/products moze byc uzyte do nazwy, product id, category id, category path, zdjecia i publication status.',
    'productCatalogData nie zawiera cen rynkowych. Nigdy nie wyliczaj market price, seller count ani competition z productCatalogData.',
    'sellerReality pochodzi z wlasnych zamowien sprzedawcy i moze byc uzyte do oceny czy produkt juz sprzedawal sie w sklepie.',
    'Jesli marketData jest dostepne, uwzglednij marketData takze w title, bulletPoints, longDescription i seoKeywords: uzyj nazwy rynkowej, zakresu cen, popularnosci, liczby sprzedawcow i notatek jako kontekstu, bez wymyslania danych spoza marketData.',
    'Recommended Price oblicz na podstawie marketData.avgPrice, marketData.minPrice, marketData.maxPrice, marketData.competitorPrice i marketData.sellerCount. Przy wysokiej konkurencji rekomenduj cene blisko avgPrice lub lekko ponizej, przy niskiej konkurencji mozna byc blizej maxPrice.',
    'Competition Level okresl na podstawie marketData.sellerCount: 0-10 niska, 11-30 srednia, powyzej 30 wysoka.',
    'Market Position okresl przez porownanie rekomendowanej ceny do min/avg/max price.',
    'Pricing Advice musi odnosic sie do avg/min/max price i sellerCount.',
    'Keyword Advice musi odnosic sie do marketData.name, keywords i marketData.notes.',
    'Jesli marketData nie jest dostepne, marketInsight ma jasno powiedziec, ze dane rynkowe nie sa podlaczone.',
    'Odpowiadasz wylacznie poprawnym JSON bez markdown.',
    'JSON musi miec dokladnie pola: title, shortDescription, bulletPoints, longDescription, seoKeywords, priceRecommendation, riskNotes, score, marketInsight.',
    'bulletPoints musi zawierac dokladnie 5 stringow.',
    'seoKeywords musi byc tablica stringow.',
    'riskNotes musi byc tablica stringow.',
    'score musi byc liczba calkowita od 0 do 100.',
    'priceRecommendation ma opisac rekomendacje cenowa po polsku, nie jako sama liczbe.',
    'marketInsight musi byc obiektem z polami: recommendedPrice, competitionLevel, marketPosition, pricingAdvice, keywordAdvice.',
  ].join(' ');
}

function readMarketNumber(marketData, key) {
  const value = Number(marketData?.[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function formatPln(value) {
  return `${Number(value || 0).toFixed(2)} PLN`;
}

function getRecommendedMarketPrice(marketData, fallbackPrice) {
  const avgPrice = readMarketNumber(marketData, 'avgPrice');
  const minPrice = readMarketNumber(marketData, 'minPrice');
  const maxPrice = readMarketNumber(marketData, 'maxPrice');
  const sellerCount = readMarketNumber(marketData, 'sellerCount');
  const base = avgPrice || fallbackPrice || 0;
  if (!base) return 0;

  let price = base;
  if (sellerCount > 30) price = base * 0.97;
  if (sellerCount > 0 && sellerCount <= 10 && maxPrice > 0) price = Math.min(maxPrice, base * 1.05);
  if (minPrice > 0) price = Math.max(minPrice, price);
  if (maxPrice > 0) price = Math.min(maxPrice, price);
  return Number(price.toFixed(2));
}

function getCompetitionLevel(marketData) {
  const sellerCount = readMarketNumber(marketData, 'sellerCount');
  if (sellerCount <= 0) return 'Brak danych o liczbie sprzedawcow w marketData.';
  if (sellerCount <= 10) return `Niska konkurencja: ${sellerCount} sprzedawcow.`;
  if (sellerCount <= 30) return `Srednia konkurencja: ${sellerCount} sprzedawcow.`;
  return `Wysoka konkurencja: ${sellerCount} sprzedawcow.`;
}

function getMarketPosition(marketData, recommendedPrice) {
  const avgPrice = readMarketNumber(marketData, 'avgPrice');
  const minPrice = readMarketNumber(marketData, 'minPrice');
  const maxPrice = readMarketNumber(marketData, 'maxPrice');
  if (!avgPrice) return 'Brak sredniej ceny w marketData.';
  if (recommendedPrice < avgPrice) return `Pozycja cenowa ponizej sredniej rynkowej ${formatPln(avgPrice)}.`;
  if (recommendedPrice > avgPrice) return `Pozycja cenowa powyzej sredniej rynkowej ${formatPln(avgPrice)}, w zakresie ${formatPln(minPrice)}-${formatPln(maxPrice)}.`;
  return `Pozycja cenowa przy sredniej rynkowej ${formatPln(avgPrice)}.`;
}

function getFallbackSuggestedPrice(input) {
  const purchasePrice = Number(input.purchasePrice || 0);
  const targetMargin = Number(input.targetMargin || 25);
  const marketAvgPrice = Number(input.marketAvgPrice || 0);
  const costPrice = purchasePrice > 0 ? purchasePrice / Math.max(0.05, 1 - targetMargin / 100) : 0;
  return marketAvgPrice > 0 ? marketAvgPrice : costPrice;
}

function normalizeAiListing(data, input) {
  const fallbackScore = Math.max(0, Math.min(100, Math.round(Number(data?.score || 0))));
  const suggestedPrice = Number(data?.suggestedPrice || getFallbackSuggestedPrice(input) || 0);
  const hasMarketData = Boolean(input?.marketData && Object.keys(input.marketData).length);
  const marketInsight = data?.marketInsight && typeof data.marketInsight === 'object' ? data.marketInsight : {};
  const recommendedMarketPrice = hasMarketData ? getRecommendedMarketPrice(input.marketData, suggestedPrice) : 0;
  const avgPrice = readMarketNumber(input.marketData, 'avgPrice');
  const minPrice = readMarketNumber(input.marketData, 'minPrice');
  const maxPrice = readMarketNumber(input.marketData, 'maxPrice');
  const sellerCount = readMarketNumber(input.marketData, 'sellerCount');
  const marketName = input.marketData?.name || input.productName || 'produkt';
  return {
    title: String(data?.title || input.productName || 'Nowy produkt'),
    shortDescription: String(data?.shortDescription || ''),
    bulletPoints: Array.isArray(data?.bulletPoints) ? data.bulletPoints.map(String).slice(0, 8) : [],
    longDescription: String(data?.longDescription || ''),
    seoKeywords: Array.isArray(data?.seoKeywords) ? data.seoKeywords.map(String).slice(0, 12) : [],
    suggestedPrice,
    priceRecommendation: String(
      data?.priceRecommendation ||
        data?.aiRecommendation ||
        `Sprawdz rentownosc przy cenie okolo ${suggestedPrice.toFixed(2)} PLN.`,
    ),
    riskNotes: Array.isArray(data?.riskNotes)
      ? data.riskNotes.map(String).slice(0, 8)
      : ['Zweryfikuj konkurencje, koszty dostawy i zgodnosc opisu z realnym produktem.'],
    score: Number.isFinite(fallbackScore) ? fallbackScore : 0,
    marketInsight: {
      recommendedPrice: String(
        marketInsight.recommendedPrice ||
          (hasMarketData ? `${formatPln(recommendedMarketPrice)} na podstawie marketData avg ${formatPln(avgPrice)}.` : 'Dane rynkowe nie sa podlaczone.'),
      ),
      competitionLevel: String(marketInsight.competitionLevel || (hasMarketData ? getCompetitionLevel(input.marketData) : 'Brak danych rynkowych.')),
      marketPosition: String(marketInsight.marketPosition || (hasMarketData ? getMarketPosition(input.marketData, recommendedMarketPrice) : 'Dane rynkowe nie sa podlaczone.')),
      pricingAdvice: String(
        marketInsight.pricingAdvice ||
          (hasMarketData
            ? `Ustaw cene w relacji do zakresu ${formatPln(minPrice)}-${formatPln(maxPrice)} i ${sellerCount} sprzedawcow.`
            : 'Dodaj dane CSV w Market Data Collector lub Product Hunter Import.'),
      ),
      keywordAdvice: String(
        marketInsight.keywordAdvice ||
          (hasMarketData ? `Uzyj fraz z marketData: ${marketName}.` : 'Po imporcie danych AI porowna slowa kluczowe z rynkiem.'),
      ),
    },
    aiRecommendation: String(data?.aiRecommendation || data?.priceRecommendation || 'Sprawdz marze, konkurencje i dostepnosc przed wystawieniem.'),
  };
}

async function generateAiListing(input, config) {
  console.log('[AI listing] request received');
  console.log('[AI listing] model', config.openaiModel);
  console.log('[AI listing] market data', input?.marketData ? 'provided' : 'not provided');

  if (!config.openaiApiKey) {
    return {
      statusCode: 503,
      data: {
        error: 'ai_unavailable',
        message: 'AI service unavailable. Check backend and OPENAI_API_KEY.',
      },
    };
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: getAiSystemPrompt(),
        },
        {
          role: 'user',
          content: JSON.stringify({
            productName: input.productName || '',
            category: input.category || '',
            keywords: input.keywords || '',
            purchasePrice: Number(input.purchasePrice || 0),
            vatPercent: Number(input.vatPercent || 0),
            targetMargin: Number(input.targetMargin || 25),
            quantity: Number(input.quantity || 0),
            packagingCost: Number(input.packagingCost || 0),
            deliveryCost: Number(input.deliveryCost || 0),
            adsCost: Number(input.adsCost || 0),
            marketAvgPrice: Number(input.marketAvgPrice || 0),
            marketRecommendation: input.marketRecommendation || '',
            marketNotes: input.marketNotes || '',
            marketData: input.marketData || null,
            productCatalogData: input.productCatalogData || null,
            sellerReality: input.sellerReality || null,
          }),
        },
      ],
      temperature: 0.4,
    }),
  });

  const body = await response.text();
  let data;

  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    data = { raw: body };
  }

  if (!response.ok) {
    return {
      statusCode: 502,
      data: {
        error: 'ai_unavailable',
        message: 'AI service unavailable. Check backend and OPENAI_API_KEY.',
        details: data?.error?.message || data?.message || response.statusText,
      },
    };
  }

  if (data?.usage) {
    console.log('[AI listing] token usage', {
      input: data.usage.prompt_tokens ?? data.usage.input_tokens ?? null,
      output: data.usage.completion_tokens ?? data.usage.output_tokens ?? null,
      total: data.usage.total_tokens ?? null,
    });
  }

  try {
    const content = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return {
      statusCode: 200,
      data: normalizeAiListing(parsed, input),
    };
  } catch (error) {
    return {
      statusCode: 502,
      data: {
        error: 'invalid_ai_response',
        message: 'AI service returned invalid JSON. Try again or adjust product data.',
        details: error.message,
      },
    };
  }
}

async function handleRequest(request, response) {
  const config = getConfig();
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    response.end();
    return;
  }

  if (url.pathname === '/api/ai/listing') {
    if (request.method !== 'POST') {
      sendJson(response, 405, {
        error: 'method_not_allowed',
        message: 'Use POST /api/ai/listing.',
      });
      return;
    }

    try {
      const input = await readJsonBody(request);
      const result = await generateAiListing(input, config);
      sendJson(response, result.statusCode, result.data);
    } catch (error) {
      sendJson(response, 400, {
        error: 'invalid_request',
        message: error.message,
      });
    }
    return;
  }

  if (url.pathname === '/api/allegro/login') {
    if (!requireConfig(response, config)) {
      return;
    }

    const authUrl = new URL(ALLEGRO_AUTH_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('scope', ALLEGRO_SCOPES);
    redirect(response, authUrl.toString());
    return;
  }

  if (url.pathname === '/api/allegro/callback') {
    if (!requireConfig(response, config)) {
      return;
    }

    const code = url.searchParams.get('code');

    if (!code) {
      sendJson(response, 400, {
        error: 'missing_code',
        message: 'Allegro callback did not include authorization code.',
      });
      return;
    }

    try {
      const token = await exchangeCodeForToken(code, config);
      sendJson(response, 200, {
        status: 'connected',
        expires_in: token.expires_in,
        message: 'Allegro account connected. You can now call /api/allegro/me and /api/allegro/search?phrase=...',
      });
    } catch (error) {
      sendJson(response, 502, {
        error: 'token_exchange_failed',
        message: error.message,
      });
    }
    return;
  }

  if (url.pathname === '/api/allegro/products-search') {
    const phrase = url.searchParams.get('phrase') || '';
    if (!phrase.trim()) {
      sendJson(response, 400, {
        error: 'missing_phrase',
        message: 'Set phrase query parameter, for example /api/allegro/products-search?phrase=Montessori.',
      });
      return;
    }

    const result = await searchAllegroProducts(phrase);
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/my-offers') {
    const result = await getSellerOffers();
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/orders-summary') {
    const result = await getOrdersSummary();
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/categories') {
    const result = await callAllegro('/sale/categories');
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/category-parameters') {
    const categoryId = url.searchParams.get('categoryId') || '';
    if (!categoryId.trim()) {
      sendJson(response, 400, {
        error: 'missing_category_id',
        message: 'Set categoryId query parameter, for example /api/allegro/category-parameters?categoryId=123.',
      });
      return;
    }

    const result = await callAllegro(`/sale/categories/${encodeURIComponent(categoryId)}/parameters`);
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/search') {
    const phrase = url.searchParams.get('phrase') || '';
    if (!phrase.trim()) {
      sendJson(response, 400, {
        error: 'missing_phrase',
        message: 'Set phrase query parameter, for example /api/allegro/search?phrase=Montessori.',
      });
      return;
    }

    if (!requireConfig(response, config)) {
      return;
    }

    const result = await searchAllegroProducts(phrase);
    const products = Array.isArray(result.data?.products) ? result.data.products.length : 0;
    console.log('[Allegro product search] fetched products', {
      phrase,
      endpoint: '/sale/products',
      count: products,
      statusCode: result.statusCode,
    });
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/me') {
    const result = await callAllegro('/me');
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/orders') {
    const result = await callAllegro('/order/checkout-forms');
    sendJson(response, result.statusCode, result.data);
    return;
  }

  if (url.pathname === '/api/allegro/offers') {
    const result = await getSellerOffers();
    sendJson(response, result.statusCode, result.data);
    return;
  }

  sendJson(response, 404, {
    error: 'not_found',
    message: 'Available endpoints: /api/ai/listing, /api/allegro/login, /api/allegro/callback, /api/allegro/products-search?phrase=, /api/allegro/my-offers, /api/allegro/orders-summary, /api/allegro/categories, /api/allegro/category-parameters?categoryId=, /api/allegro/search?phrase=, /api/allegro/me, /api/allegro/orders, /api/allegro/offers',
  });
}

loadEnv();

const config = getConfig();
const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, {
      error: 'server_error',
      message: error.message,
    });
  });
});

server.listen(config.port, () => {
  console.log(`Allegro Profit AI backend listening on http://localhost:${config.port}`);
});
