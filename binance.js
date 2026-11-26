// Source de données réelle : API publique Binance (spot), sans clé.
// Les durées de 5/10/15/30 secondes sont reconstruites à partir des bougies réelles de 1 seconde.

import { aggregate, dropUnclosed, sanitize } from './util.js';

const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];
const NATIVE = { 1: '1s', 60: '1m', 300: '5m', 900: '15m', 1800: '30m' };
const FROM_1S = [5, 10, 15, 30];

const SYMBOLS = [
  ['BTCUSDT', 'BTC/USDT'], ['ETHUSDT', 'ETH/USDT'], ['BNBUSDT', 'BNB/USDT'],
  ['SOLUSDT', 'SOL/USDT'], ['XRPUSDT', 'XRP/USDT'], ['ADAUSDT', 'ADA/USDT'],
  ['DOGEUSDT', 'DOGE/USDT'], ['LTCUSDT', 'LTC/USDT'], ['AVAXUSDT', 'AVAX/USDT'],
  ['LINKUSDT', 'LINK/USDT'], ['TRXUSDT', 'TRX/USDT'], ['DOTUSDT', 'DOT/USDT'],
];

async function getJson(path, signal) {
  let lastErr;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  throw new Error(`Binance injoignable (${lastErr?.message ?? 'erreur réseau'}).`);
}

const parseRow = (r) => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] });

/** Heure du serveur Binance (évite les erreurs si l'horloge du téléphone est décalée). */
async function serverNow(signal) {
  try {
    const { serverTime } = await getJson('/api/v3/time', signal);
    return Number.isFinite(serverTime) ? serverTime : Date.now();
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    return Date.now();
  }
}

export const binance = {
  id: 'binance',
  name: 'Binance (spot)',
  group: 'Crypto — Binance (sans clé)',
  assets: SYMBOLS.map(([symbol, label]) => ({ symbol, label })),

  supports(intervalSec) {
    return NATIVE[intervalSec] !== undefined || FROM_1S.includes(intervalSec);
  },

  async fetchCandles({ symbol, intervalSec, target = 150, signal }) {
    const now = await serverNow(signal);

    if (NATIVE[intervalSec] !== undefined) {
      const limit = Math.min(1000, target + 1);
      const rows = await getJson(`/api/v3/klines?symbol=${symbol}&interval=${NATIVE[intervalSec]}&limit=${limit}`, signal);
      return dropUnclosed(sanitize(rows.map(parseRow)), intervalSec * 1000, now);
    }

    // Durées en secondes : agrégation de vraies bougies d'1 seconde.
    const rawNeeded = (target + 2) * intervalSec;
    const chunks = Math.ceil(rawNeeded / 1000);
    const requests = Array.from({ length: chunks }, (_, k) => {
      const endTime = now - k * 1000 * 1000;
      return getJson(`/api/v3/klines?symbol=${symbol}&interval=1s&limit=1000&endTime=${endTime}`, signal);
    });
    const raw = sanitize((await Promise.all(requests)).flat().map(parseRow));
    return aggregate(raw, intervalSec, now);
  },
};
