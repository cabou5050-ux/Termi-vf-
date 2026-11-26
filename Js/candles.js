// Détection de motifs de chandeliers japonais sur la bougie d'indice i (et les précédentes).
// Retourne le motif le plus fort : { name, bias (+1 haussier, -1 baissier, 0 indécision), strength (0..1) } ou null.

const body = (c) => Math.abs(c.c - c.o);
const range = (c) => c.h - c.l;
const isBull = (c) => c.c > c.o;
const isBear = (c) => c.c < c.o;
const upperShadow = (c) => c.h - Math.max(c.o, c.c);
const lowerShadow = (c) => Math.min(c.o, c.c) - c.l;

export function detectPattern(candles, i) {
  if (i < 4 || i >= candles.length) return null;
  const c = candles[i];
  const p = candles[i - 1];
  const pp = candles[i - 2];
  const r = range(c);
  if (!(r > 0)) return null;

  const b = body(c);
  const downBefore = p.c < candles[i - 4].c;
  const upBefore = p.c > candles[i - 4].c;
  const found = [];

  // Avalements
  if (isBear(p) && isBull(c) && c.o <= p.c && c.c >= p.o && b > body(p)) {
    found.push({ name: 'Avalement haussier', bias: 1, strength: downBefore ? 0.85 : 0.6 });
  }
  if (isBull(p) && isBear(c) && c.o >= p.c && c.c <= p.o && b > body(p)) {
    found.push({ name: 'Avalement baissier', bias: -1, strength: upBefore ? 0.85 : 0.6 });
  }

  // Marteau / étoile filante (petit corps, longue mèche)
  if (b <= 0.3 * r && lowerShadow(c) >= 0.6 * r && upperShadow(c) <= 0.15 * r && downBefore) {
    found.push({ name: 'Marteau', bias: 1, strength: 0.6 });
  }
  if (b <= 0.3 * r && upperShadow(c) >= 0.6 * r && lowerShadow(c) <= 0.15 * r && upBefore) {
    found.push({ name: 'Étoile filante', bias: -1, strength: 0.6 });
  }

  // Étoile du matin / du soir (3 bougies)
  if (
    isBear(pp) && body(pp) >= 0.5 * range(pp) &&
    body(p) <= 0.3 * range(p) &&
    isBull(c) && c.c > (pp.o + pp.c) / 2
  ) {
    found.push({ name: 'Étoile du matin', bias: 1, strength: 0.8 });
  }
  if (
    isBull(pp) && body(pp) >= 0.5 * range(pp) &&
    body(p) <= 0.3 * range(p) &&
    isBear(c) && c.c < (pp.o + pp.c) / 2
  ) {
    found.push({ name: 'Étoile du soir', bias: -1, strength: 0.8 });
  }

  // Trois soldats blancs / trois corbeaux noirs
  const strong = (x) => range(x) > 0 && body(x) >= 0.5 * range(x);
  if (
    isBull(pp) && isBull(p) && isBull(c) && strong(pp) && strong(p) && strong(c) &&
    p.c > pp.c && c.c > p.c && p.o >= pp.o && p.o <= pp.c && c.o >= p.o && c.o <= p.c
  ) {
    found.push({ name: 'Trois soldats blancs', bias: 1, strength: 0.7 });
  }
  if (
    isBear(pp) && isBear(p) && isBear(c) && strong(pp) && strong(p) && strong(c) &&
    p.c < pp.c && c.c < p.c && p.o <= pp.o && p.o >= pp.c && c.o <= p.o && c.o >= p.c
  ) {
    found.push({ name: 'Trois corbeaux noirs', bias: -1, strength: 0.7 });
  }

  // Marubozu (corps plein : continuation)
  if (b >= 0.9 * r) {
    found.push(isBull(c)
      ? { name: 'Marubozu haussier', bias: 1, strength: 0.4 }
      : { name: 'Marubozu baissier', bias: -1, strength: 0.4 });
  }

  if (found.length) return found.sort((a, z) => z.strength - a.strength)[0];

  // Doji : indécision
  if (b <= 0.1 * r) return { name: 'Doji (indécision)', bias: 0, strength: 0.3 };
  return null;
}
