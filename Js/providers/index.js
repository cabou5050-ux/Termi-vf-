// Registre des sources de données.
// Pour brancher une nouvelle source réelle : créez un fichier à partir de _template.js,
// puis ajoutez-le dans la liste PROVIDERS ci-dessous. Rien d'autre à modifier.

import { binance } from './binance.js';
import { twelvedata } from './twelvedata.js';
import { otcharts } from './otcharts.js';

export const PROVIDERS = [binance, twelvedata, otcharts];

export const getProvider = (id) => PROVIDERS.find((p) => p.id === id);

/** Liste à plat de tous les actifs : { key: "provider:symbole", provider, symbol, label }. */
export function listAssets() {
  return PROVIDERS.flatMap((p) =>
    p.assets.map((a) => ({ key: `${p.id}:${a.symbol}`, provider: p, symbol: a.symbol, label: a.label })),
  );
}

/** Actualise le catalogue OTC depuis le fournisseur, sans inventer de symboles. */
export async function refreshProviderAssets() {
  for (const provider of PROVIDERS) {
    if (typeof provider.loadAssets === 'function') {
      provider.assets = await provider.loadAssets();
    }
  }
  return listAssets();
}
