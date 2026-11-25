// Indicateurs techniques : fonctions pures, sans dépendance.
// Chaque série retournée a la même longueur que l'entrée ; NaN = pas assez de données.
// Tous ces indicateurs sont « causaux » : la valeur à l'indice i ne dépend jamais des indices > i.

const nanArray = (n) => new Array(n).fill(NaN);

/** Moyenne mobile exponentielle (amorcée avec une SMA). Ignore les NaN initiaux. */
export function ema(values, period) {
  const out = nanArray(values.length);
  const start = values.findIndex((v) => Number.isFinite(v));
  if (start < 0 || values.length - start < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = start; i < start + period; i++) sum += values[i];
  let prev = sum / period;
  out[start + period - 1] = prev;
  for (let i = start + period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(closes, period = 14) {
  const out = nanArray(closes.length);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  const toRsi = () => (avgL === 0 ? (avgG === 0 ? 50 : 100) : 100 - 100 / (1 + avgG / avgL));
  out[period] = toRsi();
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + (d > 0 ? d : 0)) / period;
    avgL = (avgL * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = toRsi();
  }
  return out;
}

/** MACD (12, 26, 9 par défaut) : ligne, signal, histogramme. */
export function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line = closes.map((_, i) => (Number.isFinite(ef[i]) && Number.isFinite(es[i]) ? ef[i] - es[i] : NaN));
  const signal = ema(line, signalPeriod);
  const hist = line.map((v, i) => (Number.isFinite(v) && Number.isFinite(signal[i]) ? v - signal[i] : NaN));
  return { line, signal, hist };
}

/** Average True Range (lissage de Wilder). */
export function atr(candles, period = 14) {
  const n = candles.length;
  const out = nanArray(n);
  if (n <= period) return out;
  const tr = (i) =>
    Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c),
    );
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr(i);
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr(i)) / period;
    out[i] = prev;
  }
  return out;
}

/** Largeur relative des bandes de Bollinger : (haute - basse) / moyenne. */
export function bollingerBandwidth(closes, period = 20, mult = 2) {
  const out = nanArray(closes.length);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let k = i - period + 1; k <= i; k++) sum += closes[k];
    const mean = sum / period;
    let sq = 0;
    for (let k = i - period + 1; k <= i; k++) sq += (closes[k] - mean) ** 2;
    const std = Math.sqrt(sq / period);
    out[i] = mean > 0 ? (2 * mult * std) / mean : NaN;
  }
  return out;
}

/** Momentum brut : variation de prix sur `period` bougies. */
export function momentum(closes, period = 10) {
  const out = nanArray(closes.length);
  for (let i = period; i < closes.length; i++) out[i] = closes[i] - closes[i - period];
  return out;
}

/** Régression linéaire sur les n dernières valeurs finissant à `end` : pente et R². */
export function linearRegression(values, end, n) {
  const start = end - n + 1;
  if (start < 0) return null;
  const base = values[start]; // recentrage pour limiter les erreurs d'arrondi
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let k = 0; k < n; k++) {
    const y = values[start + k] - base;
    sx += k;
    sy += y;
    sxx += k * k;
    sxy += k * y;
    syy += y * y;
  }
  const denX = n * sxx - sx * sx;
  const denY = n * syy - sy * sy;
  const cov = n * sxy - sx * sy;
  return { slope: cov / denX, r2: denY === 0 ? 0 : (cov * cov) / (denX * denY) };
}
