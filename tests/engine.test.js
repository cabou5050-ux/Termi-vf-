// Tests du moteur. Les séries ci-dessous sont des jeux d'essai déterministes réservés aux tests :
// elles ne sont jamais utilisées ni affichées par l'application.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ema, rsi, atr, macd, linearRegression } from '../js/indicators.js';
import { detectPattern } from '../js/candles.js';
import { computeIndicators, evaluateAt, backtest, analyze, MIN_BARS } from '../js/engine.js';
import { aggregate, dropUnclosed } from '../js/providers/util.js';

function makeCandles(n, drift, noise = 0.3, seed = 1) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  let price = 100;
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = price;
    const c = o + drift + (rnd() - 0.5) * noise * 2;
    out.push({ t: i * 60000, o, h: Math.max(o, c) + rnd() * noise * 0.5, l: Math.min(o, c) - rnd() * noise * 0.5, c, v: 1 });
    price = c;
  }
  return out;
}

test('EMA d’une série constante = la constante', () => {
  const out = ema(new Array(30).fill(5), 9);
  assert.ok(Number.isNaN(out[7]));
  assert.equal(out[8], 5);
  assert.equal(out[29], 5);
});

test('RSI : 100 en hausse continue, 0 en baisse continue', () => {
  const up = Array.from({ length: 40 }, (_, i) => 10 + i);
  const down = Array.from({ length: 40 }, (_, i) => 100 - i);
  assert.equal(rsi(up, 14)[39], 100);
  assert.equal(rsi(down, 14)[39], 0);
});

test('RSI : valeurs de référence de Wilder', () => {
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28,
    46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  const r = rsi(closes, 14);
  assert.ok(Math.abs(r[14] - 70.53) < 0.1, `RSI[14] = ${r[14]}`);
  assert.ok(Math.abs(r[15] - 66.32) < 0.1, `RSI[15] = ${r[15]}`);
});

test('ATR d’une série à amplitude constante', () => {
  const candles = Array.from({ length: 30 }, (_, i) => ({ t: i, o: 10, h: 11, l: 9, c: 10, v: 1 }));
  assert.ok(Math.abs(atr(candles, 14)[29] - 2) < 1e-12);
});

test('MACD : histogramme positif en tendance haussière', () => {
  const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 0.1);
  const { line } = macd(closes);
  assert.ok(line[79] > 0);
});

test('Régression linéaire : pente exacte et R² = 1 sur une droite', () => {
  const v = Array.from({ length: 20 }, (_, i) => 50000 + 3 * i);
  const lr = linearRegression(v, 19, 20);
  assert.ok(Math.abs(lr.slope - 3) < 1e-9);
  assert.ok(Math.abs(lr.r2 - 1) < 1e-9);
});

test('Chandeliers : avalement haussier détecté', () => {
  const c = (o, cl, h, l) => ({ t: 0, o, h, l, c: cl, v: 1 });
  const candles = [
    c(12.5, 12, 12.6, 11.9),
    c(12, 11.2, 12.1, 11.1),
    c(11.2, 10.5, 11.3, 10.4),
    c(10, 9, 10.1, 8.9), // baissière
    c(8.8, 10.2, 10.3, 8.7), // avalement
  ];
  const p = detectPattern(candles, 4);
  assert.equal(p.name, 'Avalement haussier');
  assert.equal(p.bias, 1);
});

test('Moteur : tendance haussière nette → HAUSSIÈRE', () => {
  const candles = makeCandles(150, 0.5);
  const { evaluation } = analyze(candles);
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.verdict, 'UP');
  assert.ok(evaluation.confidence > 0 && evaluation.confidence <= 100);
});

test('Moteur : tendance baissière nette → BAISSIÈRE', () => {
  const candles = makeCandles(150, -0.5);
  const { evaluation } = analyze(candles);
  assert.equal(evaluation.verdict, 'DOWN');
});

test('Moteur : refuse d’analyser sans assez de données (aucune valeur inventée)', () => {
  const candles = makeCandles(30, 0.1);
  const ev = evaluateAt(computeIndicators(candles), candles, candles.length - 1);
  assert.equal(ev.ok, false);
  assert.match(ev.reason, /insuffisantes/);
});

test('Moteur : aucune fuite du futur (résultat identique avec ou sans les bougies suivantes)', () => {
  const candles = makeCandles(200, 0.05, 0.6, 7);
  const i = 130;
  const full = evaluateAt(computeIndicators(candles), candles, i);
  const cut = candles.slice(0, i + 1);
  const part = evaluateAt(computeIndicators(cut), cut, i);
  assert.deepEqual(part, full);
});

test('Backtest : comptes cohérents et proportion entre 0 et 1', () => {
  const candles = makeCandles(300, 0.02, 0.8, 3);
  const ind = computeIndicators(candles);
  const bt = backtest(ind, candles, 1);
  assert.ok(bt.n <= candles.length - MIN_BARS - 1);
  assert.ok(bt.hits <= bt.n);
  if (bt.n > 0) {
    assert.ok(bt.rate >= 0 && bt.rate <= 1);
    assert.ok(bt.low <= bt.rate && bt.rate <= bt.high);
  }
});

test('Agrégation 1 s → 5 s : OHLCV exact, groupe initial et groupe non clôturé ignorés', () => {
  const raw = [];
  for (let k = 2; k <= 21; k++) raw.push({ t: k * 1000, o: k, h: k + 0.5, l: k - 0.5, c: k + 0.1, v: 1 });
  const out = aggregate(raw, 5, 24000);
  assert.deepEqual(out.map((x) => x.t), [5000, 10000, 15000]);
  assert.equal(out[0].o, 5);
  assert.equal(out[0].c, 9.1);
  assert.equal(out[0].h, 9.5);
  assert.equal(out[0].l, 4.5);
  assert.equal(out[0].v, 5);
});

test('dropUnclosed retire la bougie en cours', () => {
  const candles = [{ t: 0 }, { t: 60000 }, { t: 120000 }];
  assert.equal(dropUnclosed(candles, 60000, 150000).length, 2);
});
