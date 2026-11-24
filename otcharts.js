// Données OTC Pocket Option via OTCharts. La clé reste côté serveur (OTCHARTS_API_KEY).
import { dropUnclosed, sanitize } from './util.js';

const INTERVALS = new Set([5, 15, 30, 60, 120, 180, 300, 600, 900, 1800, 3600, 14400]);

export const otcharts = {
  id: 'otcharts',
  name: 'Pocket Option OTC (OTCharts)',
  group: 'Pocket Option — catalogue OTC (OTCharts)',
  assets: [
    { symbol: 'EURUSD_otc', label: 'EUR/USD OTC' },
    { symbol: 'GBPUSD_otc', label: 'GBP/USD OTC' },
    { symbol: 'USDJPY_otc', label: 'USD/JPY OTC' },
    { symbol: 'AUDUSD_otc', label: 'AUD/USD OTC' },
    { symbol: 'BTCUSD_otc', label: 'BTC/USD OTC' },
  ],

  async loadAssets() {
    const res = await fetch('/api/otc/symbols', { headers: { Accept: 'application/json' } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Catalogue OTC : erreur HTTP ${res.status}.`);
    if (!Array.isArray(json.symbols) || json.symbols.length === 0) {
      throw new Error('Le fournisseur OTC n’a retourné aucun instrument.');
    }
    return json.symbols.map((item) => ({
      symbol: item.symbol,
      label: item.name || item.symbol,
      isOpen: item.open ?? null,
      payout: item.payout ?? null,
      isOtc: item.isOtc ?? true,
    }));
  },

  supports(intervalSec) {
    return INTERVALS.has(intervalSec);
  },

  async fetchCandles({ symbol, intervalSec, target = 150, signal }) {
    if (!this.assets.some((asset) => asset.symbol === symbol)) {
      throw new Error('Cet instrument ne figure pas dans le catalogue OTC chargé.');
    }
    if (!this.supports(intervalSec)) {
      throw new Error('Durée non prise en charge par la source OTC.');
    }
    const url = `/api/otc/candles?symbol=${encodeURIComponent(symbol)}&tf=${intervalSec}&limit=${Math.min(1500, target + 1)}`;
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `OTCharts : erreur HTTP ${res.status}.`);
    if (!Array.isArray(json.candles)) throw new Error('OTCharts : format de réponse inattendu.');

    const candles = json.candles.map((v) => ({
      t: (Number(v.time) - 7200) * 1000,
      o: Number(v.open), h: Number(v.high), l: Number(v.low), c: Number(v.close),
      v: Number(v.volume) || 0,
    }));
    const clean = sanitize(candles);
    const closed = dropUnclosed(clean, intervalSec * 1000, Date.now());
    if (closed.length < 61) {
      throw new Error(`OTCharts : seulement ${closed.length} bougies clôturées reçues. Il en faut au moins 61.`);
    }
    return closed.slice(-target);
  },
};
