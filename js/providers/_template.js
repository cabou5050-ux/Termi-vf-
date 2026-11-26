// MODÈLE pour connecter une nouvelle source de données financières réelle.
// Ce fichier n'est PAS importé par l'application : copiez-le, adaptez-le, puis ajoutez-le
// à la liste PROVIDERS de providers/index.js.
//
// Contrat à respecter :
//  - id, name, group : identifiants et libellés affichés ;
//  - assets : [{ symbol, label }] ;
//  - supports(intervalSec) : true uniquement si la source peut fournir CETTE durée avec de vraies données ;
//  - fetchCandles({ symbol, intervalSec, target, settings, signal }) : renvoie des bougies CLÔTURÉES,
//    triées par temps croissant, au format { t (ms UTC d'ouverture), o, h, l, c, v }.
//    En cas d'échec, lancez une Error avec un message clair : l'application l'affiche telle quelle.
//    Ne renvoyez jamais de données simulées ou aléatoires.
//
// Remarque : une source appelée depuis le navigateur doit autoriser le CORS. Si ce n'est pas le cas,
// passez par un petit serveur intermédiaire à vous (proxy) qui ajoute l'en-tête Access-Control-Allow-Origin.

import { dropUnclosed, sanitize } from './util.js';

export const maSource = {
  id: 'ma-source',
  name: 'Ma source',
  group: 'Ma source (description)',
  assets: [{ symbol: 'EURUSD', label: 'EUR/USD' }],

  supports(intervalSec) {
    return [60, 300, 900, 1800].includes(intervalSec);
  },

  async fetchCandles({ symbol, intervalSec, target = 150, settings, signal }) {
    const res = await fetch(`https://exemple.invalid/candles?symbol=${symbol}&interval=${intervalSec}&limit=${target}`, { signal });
    if (!res.ok) throw new Error(`Ma source : erreur HTTP ${res.status}.`);
    const rows = await res.json();
    const candles = rows.map((r) => ({ t: r.time, o: +r.open, h: +r.high, l: +r.low, c: +r.close, v: +r.volume || 0 }));
    return dropUnclosed(sanitize(candles), intervalSec * 1000, Date.now());
  },
};
