// Moteur d'analyse : combine RSI, MACD, EMA, chandeliers, tendance, volatilité et momentum.
//
// Principe :
//  - chaque indicateur directionnel émet un vote entre -1 (baissier) et +1 (haussier) ;
//  - le score est la moyenne pondérée des votes actifs ;
//  - la « confiance » est la part du poids qui va dans le sens du verdict (convergence),
//    atténuée si la volatilité est anormale. Ce n'est PAS une probabilité de gain ;
//  - un backtest « marche avant » mesure ce que ce même moteur aurait donné sur les bougies
//    réellement chargées (aucune donnée inventée).

import { ema, rsi, macd, atr, bollingerBandwidth, momentum, linearRegression } from './indicators.js';
import { detectPattern } from './candles.js';

export const MIN_BARS = 60; // indice minimal analysable (EMA 50 + marge)
export const THRESHOLD = 0.15; // |score| minimal pour sortir de « NEUTRE »
export const WEIGHTS = { rsi: 1, macd: 1.3, ema: 1.3, candle: 0.8, trend: 1.2, momentum: 0.9 };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const median = (arr) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function computeIndicators(candles) {
  const closes = candles.map((c) => c.c);
  return {
    closes,
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    rsi: rsi(closes, 14),
    macd: macd(closes, 12, 26, 9),
    atr: atr(candles, 14),
    bbw: bollingerBandwidth(closes, 20, 2),
    mom10: momentum(closes, 10),
  };
}

/** Évalue la situation à la bougie d'indice i, en n'utilisant que les bougies 0..i. */
export function evaluateAt(ind, candles, i) {
  if (!Number.isInteger(i) || i < MIN_BARS || i >= candles.length) {
    return {
      ok: false,
      reason: `Données insuffisantes : ${Math.max(0, i + 1)} bougies disponibles, ${MIN_BARS + 1} minimum requises.`,
    };
  }
  const price = candles[i].c;
  const a = ind.atr[i];
  if (!(a > 0)) {
    return { ok: false, reason: 'Aucune variation mesurable sur la période analysée (volatilité nulle).' };
  }

  const votes = [];

  // --- RSI (14) ---
  {
    const r = ind.rsi[i];
    const rPrev = ind.rsi[i - 3];
    let vote;
    let text;
    if (r >= 70) {
      vote = -(0.2 + 0.8 * clamp((r - 70) / 15, 0, 1));
      text = `RSI à ${r.toFixed(1)} : zone de surachat, risque de repli.`;
    } else if (r <= 30) {
      vote = 0.2 + 0.8 * clamp((30 - r) / 15, 0, 1);
      text = `RSI à ${r.toFixed(1)} : zone de survente, rebond possible.`;
    } else {
      vote = clamp(clamp((r - 50) / 40, -0.5, 0.5) + clamp((r - rPrev) / 20, -0.3, 0.3), -1, 1);
      text = `RSI à ${r.toFixed(1)} : ${r > 50 ? 'pression acheteuse' : 'pression vendeuse'}, ${r >= rPrev ? 'en hausse' : 'en baisse'} sur 3 bougies.`;
    }
    votes.push({ key: 'rsi', label: 'RSI (14)', vote, weight: WEIGHTS.rsi, active: true, text });
  }

  // --- MACD (12, 26, 9) ---
  {
    const h = ind.macd.hist[i];
    const hPrev = ind.macd.hist[i - 1];
    const level = clamp((h / a) * 4, -1, 1);
    const dir = h > hPrev ? 1 : h < hPrev ? -1 : 0;
    const vote = clamp(0.7 * level + 0.3 * dir, -1, 1);
    const trendTxt = dir > 0 ? 'en hausse' : dir < 0 ? 'en baisse' : 'stable';
    votes.push({
      key: 'macd', label: 'MACD (12, 26, 9)', vote, weight: WEIGHTS.macd, active: true,
      text: `Histogramme ${h > 0 ? 'positif' : 'négatif'} et ${trendTxt} : élan ${vote > 0.1 ? 'haussier' : vote < -0.1 ? 'baissier' : 'indécis'}.`,
    });
  }

  // --- Moyennes mobiles EMA 9 / 21 / 50 ---
  {
    const e9 = ind.ema9[i];
    const e21 = ind.ema21[i];
    const e50 = ind.ema50[i];
    const align = (sign(e9 - e21) + sign(e21 - e50)) / 2;
    const vote = clamp(0.7 * align + 0.3 * sign(price - e21), -1, 1);
    const txt =
      align === 1 ? 'EMA 9 > EMA 21 > EMA 50 : alignement haussier'
        : align === -1 ? 'EMA 9 < EMA 21 < EMA 50 : alignement baissier'
          : 'EMA entremêlées : pas d’alignement net';
    votes.push({
      key: 'ema', label: 'Moyennes mobiles EMA', vote, weight: WEIGHTS.ema, active: true,
      text: `${txt} ; prix ${price > e21 ? 'au-dessus' : 'sous'} l’EMA 21.`,
    });
  }

  // --- Chandeliers japonais ---
  {
    const p = detectPattern(candles, i);
    if (p) {
      const vote = p.bias * p.strength;
      const bias = p.bias > 0 ? 'signal haussier' : p.bias < 0 ? 'signal baissier' : 'indécision du marché';
      votes.push({
        key: 'candle', label: 'Chandeliers japonais', vote, weight: WEIGHTS.candle, active: true,
        text: `Motif détecté : ${p.name} (${bias}).`,
      });
    } else {
      votes.push({
        key: 'candle', label: 'Chandeliers japonais', vote: 0, weight: WEIGHTS.candle, active: false,
        text: 'Aucun motif significatif sur la dernière bougie (non pris en compte).',
      });
    }
  }

  // --- Détection de tendance (régression linéaire sur 20 bougies) ---
  {
    const n = 20;
    const lr = linearRegression(ind.closes, i, n);
    const move = (lr.slope * (n - 1)) / a; // déplacement total en multiples d'ATR
    const vote = clamp(move / 3, -1, 1) * (0.5 + 0.5 * lr.r2);
    const strength = lr.r2 >= 0.6 ? 'nette' : lr.r2 >= 0.3 ? 'modérée' : 'faible';
    const dirTxt = vote > 0.1 ? 'haussière' : vote < -0.1 ? 'baissière' : 'latérale';
    votes.push({
      key: 'trend', label: 'Tendance (20 bougies)', vote, weight: WEIGHTS.trend, active: true,
      text: `Tendance ${dirTxt}, ${strength} (R² = ${lr.r2.toFixed(2)}, déplacement ${move >= 0 ? '+' : ''}${move.toFixed(1)} ATR).`,
    });
  }

  // --- Momentum (10 bougies) ---
  {
    const x = ind.mom10[i] / a;
    const vote = clamp(x / 4, -1, 1);
    votes.push({
      key: 'momentum', label: 'Momentum (10)', vote, weight: WEIGHTS.momentum, active: true,
      text: `Variation sur 10 bougies : ${x >= 0 ? '+' : ''}${x.toFixed(1)} ATR (${vote > 0.1 ? 'élan haussier' : vote < -0.1 ? 'élan baissier' : 'élan faible'}).`,
    });
  }

  // --- Volatilité (non directionnelle : module la confiance) ---
  const window = [];
  for (let k = i - 49; k <= i; k++) if (Number.isFinite(ind.bbw[k])) window.push(ind.bbw[k]);
  const med = median(window);
  const ratio = med > 0 ? ind.bbw[i] / med : 1;
  let regime = 'normale';
  let factor = 1;
  if (ratio >= 2) { regime = 'très élevée'; factor = 0.8; }
  else if (ratio >= 1.5) { regime = 'élevée'; factor = 0.9; }
  else if (ratio <= 0.5) { regime = 'très faible (compression)'; factor = 0.85; }
  const atrPct = (a / price) * 100;
  const volatility = {
    atrPct, ratio, regime, factor,
    text: `Volatilité ${regime} : ATR = ${atrPct.toFixed(3)} % du prix, bandes de Bollinger à ${ratio.toFixed(2)}× leur médiane récente${factor < 1 ? ' — confiance réduite' : ''}.`,
  };

  // --- Agrégation ---
  const active = votes.filter((v) => v.active);
  const totalW = active.reduce((s, v) => s + v.weight, 0);
  const score = active.reduce((s, v) => s + v.weight * v.vote, 0) / totalW;
  const verdict = score > THRESHOLD ? 'UP' : score < -THRESHOLD ? 'DOWN' : 'NEUTRAL';

  let base;
  if (verdict === 'NEUTRAL') {
    base = 1 - Math.abs(score) / THRESHOLD; // équilibre entre forces opposées
  } else {
    const dir = verdict === 'UP' ? 1 : -1;
    const agree = active
      .filter((v) => sign(v.vote) === dir && Math.abs(v.vote) >= 0.1)
      .reduce((s, v) => s + v.weight, 0);
    base = agree / totalW;
  }
  const confidence = Math.round(clamp(base * factor, 0, 1) * 100);

  return { ok: true, index: i, time: candles[i].t, price, votes, score, verdict, confidence, volatility };
}

/** Intervalle de Wilson à 95 % pour une proportion k/n. */
function wilson(k, n, z = 1.96) {
  if (!n) return { low: null, high: null };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: (c - m) / d, high: (c + m) / d };
}

/**
 * Backtest « marche avant » : à chaque bougie passée, le moteur n'utilise que les données
 * disponibles à cet instant ; on compare son verdict (non neutre) au sens réel de la bougie suivante.
 */
export function backtest(ind, candles, horizon = 1) {
  let n = 0;
  let hits = 0;
  let ties = 0;
  for (let i = MIN_BARS; i < candles.length - horizon; i++) {
    const ev = evaluateAt(ind, candles, i);
    if (!ev.ok || ev.verdict === 'NEUTRAL') continue;
    const move = candles[i + horizon].c - candles[i].c;
    if (move === 0) { ties++; continue; }
    n++;
    if (move > 0 === (ev.verdict === 'UP')) hits++;
  }
  return { n, hits, ties, rate: n ? hits / n : null, ...wilson(hits, n) };
}

/** Analyse complète d'une série de bougies clôturées. */
export function analyze(candles) {
  const ind = computeIndicators(candles);
  const evaluation = evaluateAt(ind, candles, candles.length - 1);
  const bt = evaluation.ok ? backtest(ind, candles, 1) : null;
  return { ind, evaluation, backtest: bt };
}
