// Utilitaires communs aux sources de données.
// Format standard d'une bougie : { t: ouverture en ms (UTC), o, h, l, c, v }.

/** Retire les bougies non encore clôturées (t + durée > now). */
export function dropUnclosed(candles, intervalMs, now) {
  return candles.filter((k) => k.t + intervalMs <= now);
}

/**
 * Agrège des bougies de 1 seconde (triées par temps croissant) en bougies de `sec` secondes.
 * - le premier groupe est ignoré (il peut être tronqué par le début de la fenêtre chargée) ;
 * - les groupes dont la fin est postérieure à `now` sont ignorés (pas encore clôturés).
 */
export function aggregate(raw, sec, now) {
  const size = sec * 1000;
  const groups = [];
  let cur = null;
  for (const k of raw) {
    const bucket = Math.floor(k.t / size) * size;
    if (!cur || cur.t !== bucket) {
      cur = { t: bucket, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v };
      groups.push(cur);
    } else {
      cur.h = Math.max(cur.h, k.h);
      cur.l = Math.min(cur.l, k.l);
      cur.c = k.c;
      cur.v += k.v;
    }
  }
  return groups.slice(1).filter((g) => g.t + size <= now);
}

/** Valide et nettoie une série : numérique, triée, sans doublons. */
export function sanitize(candles) {
  const seen = new Set();
  return candles
    .filter((k) => [k.t, k.o, k.h, k.l, k.c].every(Number.isFinite) && !seen.has(k.t) && seen.add(k.t))
    .sort((a, b) => a.t - b.t);
}
