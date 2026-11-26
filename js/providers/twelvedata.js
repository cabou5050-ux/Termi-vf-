// Source de données réelles Twelve Data. Clé personnelle requise dans les réglages.
// Les symboles proposés ci-dessous couvrent les grandes familles d'actifs ; la disponibilité
// effective dépend du catalogue, du marché et du forfait Twelve Data de l'utilisateur.
import { dropUnclosed, sanitize } from './util.js';

const INTERVALS = { 60: '1min', 300: '5min', 900: '15min', 1800: '30min' };

const GROUPS = {
  'Forex': [
    'EUR/USD','GBP/USD','USD/JPY','AUD/USD','USD/CAD','USD/CHF','NZD/USD','EUR/GBP','EUR/JPY','GBP/JPY',
    'AUD/JPY','EUR/AUD','EUR/CAD','EUR/CHF','EUR/NZD','GBP/AUD','GBP/CAD','GBP/CHF','GBP/NZD','CAD/JPY',
    'CAD/CHF','CHF/JPY','AUD/CAD','AUD/CHF','AUD/NZD','NZD/JPY','NZD/CAD','NZD/CHF','USD/SGD','USD/HKD',
    'USD/MXN','USD/ZAR','USD/TRY','USD/SEK','USD/NOK','USD/DKK','USD/PLN','USD/CNH','EUR/PLN','EUR/TRY',
    'EUR/SEK','EUR/NOK','EUR/DKK','GBP/SGD','GBP/JPY','SGD/JPY','HKD/JPY','ZAR/JPY','TRY/JPY','MXN/JPY'
  ],
  'Matières premières': ['XAU/USD','XAG/USD','XPT/USD','XPD/USD','WTI','BRENT','NATGAS'],
  'Actions': [
    'AAPL','MSFT','AMZN','TSLA','NVDA','META','GOOGL','NFLX','AMD','INTC','IBM','ORCL','JPM','BAC','V',
    'MA','KO','PEP','MCD','DIS','PFE','JNJ','WMT','COST','BA','XOM','CVX','CSCO','UBER','COIN'
  ],
  'Indices': ['SPX','NDX','DJI','RUT','VIX','DAX','FTSE','N225','HSI','STOXX50E'],
  'Cryptomonnaies': ['BTC/USD','ETH/USD','SOL/USD','BNB/USD','XRP/USD','ADA/USD','DOGE/USD','LTC/USD','AVAX/USD','LINK/USD']
};

const ASSETS = Object.entries(GROUPS).flatMap(([category, symbols]) =>
  symbols.map((symbol) => ({ symbol, label: `${symbol} · ${category}` }))
);

export const twelvedata = {
  id: 'twelvedata',
  name: 'Twelve Data',
  group: 'Marchés classiques — Forex, matières premières, actions, indices & cryptos (clé requise)',
  assets: ASSETS,

  supports(intervalSec) {
    return INTERVALS[intervalSec] !== undefined;
  },

  async fetchCandles({ symbol, intervalSec, target = 150, settings, signal }) {
    const key = settings?.twelveDataKey?.trim();
    if (!key) throw new Error('Clé API Twelve Data manquante : ouvrez les Réglages (⚙) pour la saisir.');
    const interval = INTERVALS[intervalSec];
    if (!interval) throw new Error('Durée non prise en charge par Twelve Data.');

    const url = 'https://api.twelvedata.com/time_series' +
      `?symbol=${encodeURIComponent(symbol)}&interval=${interval}` +
      `&outputsize=${Math.min(5000, target + 1)}&timezone=UTC&order=asc&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Twelve Data : erreur HTTP ${res.status}.`);
    const json = await res.json();
    if (json.status === 'error' || !Array.isArray(json.values)) {
      throw new Error(`Twelve Data : ${json.message ?? 'symbole indisponible ou accès non inclus dans votre forfait'}`);
    }
    const candles = json.values.map((v) => ({
      t: Date.parse(`${v.datetime.replace(' ', 'T')}Z`),
      o: Number(v.open), h: Number(v.high), l: Number(v.low), c: Number(v.close),
      v: Number(v.volume) || 0,
    }));
    const closed = dropUnclosed(sanitize(candles), intervalSec * 1000, Date.now());
    if (closed.length < 61) throw new Error(`Twelve Data : seulement ${closed.length} bougies clôturées disponibles pour ${symbol}. Il en faut au moins 61.`);
    return closed.slice(-target);
  },
};
