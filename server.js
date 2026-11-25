// Serveur Node : fichiers statiques + proxy sécurisé pour OTCharts.
// Définir OTCHARTS_API_KEY dans les variables d'environnement de l'hébergeur.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};
const OTC_TFS = new Set([5, 15, 30, 60, 120, 180, 300, 600, 900, 1800, 3600, 14400]);
let otcCatalogCache = { at: 0, symbols: [] };

async function getOtcCatalog(force = false) {
  const key = process.env.OTCHARTS_API_KEY?.trim();
  if (!key) throw new Error('Mode OTC non configuré : ajoutez OTCHARTS_API_KEY aux variables secrètes du serveur.');
  if (!force && Date.now() - otcCatalogCache.at < 5 * 60 * 1000 && otcCatalogCache.symbols.length) {
    return otcCatalogCache.symbols;
  }
  const upstream = await fetch('https://otcharts.com/v1/symbols?venue=otc', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) throw new Error(body.error || body.message || `OTCharts a répondu HTTP ${upstream.status}.`);
  if (!Array.isArray(body.symbols)) throw new Error('Réponse invalide du catalogue OTCharts.');
  otcCatalogCache = { at: Date.now(), symbols: body.symbols };
  return otcCatalogCache.symbols;
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function otcCandles(url, res) {
  const key = process.env.OTCHARTS_API_KEY?.trim();
  if (!key) return sendJson(res, 503, { error: 'Mode OTC non configuré : la clé OTCharts doit être ajoutée aux variables d’environnement du serveur.' });

  const symbol = url.searchParams.get('symbol') || '';
  const tf = Number(url.searchParams.get('tf'));
  const limit = Math.max(60, Math.min(500, Number(url.searchParams.get('limit')) || 150));
  if (!/^[A-Za-z0-9#_./-]{2,40}$/.test(symbol)) return sendJson(res, 400, { error: 'Symbole invalide.' });
  if (!OTC_TFS.has(tf)) return sendJson(res, 400, { error: 'Durée non prise en charge. Utilisez 1, 5, 15 ou 30 minutes.' });

  try {
    const catalog = await getOtcCatalog();
    if (!catalog.some((item) => item.symbol === symbol)) {
      return sendJson(res, 400, { error: 'Cet instrument ne figure pas dans le catalogue Pocket Option OTC de votre fournisseur.' });
    }
  } catch (err) {
    return sendJson(res, 502, { error: err.message || 'Catalogue OTC indisponible.' });
  }

  const apiUrl = new URL('https://otcharts.com/v1/candles');
  apiUrl.search = new URLSearchParams({ venue: 'otc', symbol, tf: String(tf), limit: String(limit) });
  try {
    const upstream = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = body.error || body.message || `OTCharts a répondu HTTP ${upstream.status}.`;
      return sendJson(res, upstream.status, { error: `Source OTC : ${message}` });
    }
    if (!Array.isArray(body.candles)) return sendJson(res, 502, { error: 'Réponse OTC invalide : bougies absentes.' });
    return sendJson(res, 200, { candles: body.candles });
  } catch (err) {
    return sendJson(res, 502, { error: `Impossible de joindre OTCharts : ${err.name === 'TimeoutError' ? 'délai dépassé' : 'connexion indisponible'}.` });
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { status: 'ok', service: 'terminator-trading' });
    }
    if (req.method === 'GET' && url.pathname === '/api/otc/symbols') {
      try {
        const symbols = await getOtcCatalog();
        return sendJson(res, 200, { symbols });
      } catch (err) {
        return sendJson(res, 503, { error: err.message || 'Catalogue OTC indisponible.' });
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/otc/candles') {
      return await otcCandles(url, res);
    }
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Route API introuvable.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Méthode non autorisée.' });

    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(ROOT, `.${normalize(path)}`);
    if (!file.startsWith(`${ROOT}/`) && file !== ROOT) throw new Error('forbidden');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
  }
}).listen(PORT, () => console.log(`Terminator Trading Prédiction : port ${PORT}`));
