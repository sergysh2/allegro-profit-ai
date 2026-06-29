import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { URL } from 'node:url';

const ALLEGRO_AUTH_URL = 'https://allegro.pl/auth/oauth/authorize';
const ALLEGRO_TOKEN_URL = 'https://allegro.pl/auth/oauth/token';
const ALLEGRO_API_URL = 'https://api.allegro.pl';
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

async function handleRequest(request, response) {
  const config = getConfig();
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    response.end();
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

    const result = await callAllegro(`/sale/products?phrase=${encodeURIComponent(phrase)}&language=pl-PL`);
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
    message: 'Available endpoints: /api/allegro/login, /api/allegro/callback, /api/allegro/search?phrase=, /api/allegro/me, /api/allegro/orders, /api/allegro/offers',
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
