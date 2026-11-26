import { PROVIDERS, listAssets, getProvider, refreshProviderAssets } from './providers/index.js';
import { computeIndicators, evaluateAt, backtest } from './engine.js';
import { loadSettings, saveSettings, loadHistory, addHistory, clearHistory } from './storage.js';

const DURATIONS = [
  { sec: 5, label: '5 s' }, { sec: 10, label: '10 s' }, { sec: 15, label: '15 s' }, { sec: 30, label: '30 s' },
  { sec: 60, label: '1 min' }, { sec: 120, label: '2 min' }, { sec: 180, label: '3 min' },
  { sec: 300, label: '5 min' }, { sec: 600, label: '10 min' }, { sec: 900, label: '15 min' },
  { sec: 1800, label: '30 min' }, { sec: 3600, label: '1 h' }, { sec: 14400, label: '4 h' },
];

const VERDICT = {
  UP: { label: 'TENDANCE HAUSSIÈRE', short: 'HAUSSIÈRE', cls: 'up', arrow: '▲' },
  DOWN: { label: 'TENDANCE BAISSIÈRE', short: 'BAISSIÈRE', cls: 'down', arrow: '▼' },
  NEUTRAL: { label: 'NEUTRE', short: 'NEUTRE', cls: 'neutral', arrow: '■' },
};

const TARGET_CANDLES = 150;
const TIMEOUT_MS = 25000;
let ASSETS = listAssets();

const $ = (id) => document.getElementById(id);

/** Petit constructeur DOM (jamais d'innerHTML : tout est inséré comme texte). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const fmtTime = (ms) =>
  new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const fmtAge = (sec) => {
  if (sec < 90) return `${Math.round(sec)} s`;
  if (sec < 5400) return `${Math.round(sec / 60)} min`;
  if (sec < 172800) return `${Math.round(sec / 3600)} h`;
  return `${Math.round(sec / 86400)} j`;
};

const state = { assetKey: null, intervalSec: 60, busy: false };

// ---------- Sélecteurs ----------

function buildAssetSelect() {
  const select = $('asset');
  select.replaceChildren();
  for (const p of PROVIDERS) {
    const group = h('optgroup', { label: p.group });
    for (const a of ASSETS.filter((x) => x.provider.id === p.id)) {
      group.append(h('option', { value: a.key, text: a.label }));
    }
    select.append(group);
  }
  select.value = state.assetKey;
  select.addEventListener('change', () => {
    state.assetKey = select.value;
    saveSettings({ assetKey: state.assetKey });
    refreshDurations();
  });
}

function currentProvider() {
  return getProvider(state.assetKey.split(':')[0]);
}

function refreshDurations() {
  const provider = currentProvider();
  if (!provider.supports(state.intervalSec)) {
    const first = DURATIONS.find((d) => provider.supports(d.sec));
    if (first) state.intervalSec = first.sec;
  }
  const box = $('durations');
  box.replaceChildren();
  for (const d of DURATIONS) {
    const ok = provider.supports(d.sec);
    const selected = d.sec === state.intervalSec;
    box.append(
      h('button', {
        type: 'button', class: `chip${selected ? ' on' : ''}`, role: 'radio',
        'aria-checked': String(selected), disabled: !ok,
        title: ok ? null : `Non disponible avec la source ${provider.name}`,
        text: d.label,
        onclick: () => {
          state.intervalSec = d.sec;
          saveSettings({ intervalSec: d.sec });
          refreshDurations();
        },
      }),
    );
  }
  const unsupported = DURATIONS.some((d) => !provider.supports(d.sec));
  $('durationNote').hidden = !unsupported;
  $('durationNote').textContent = unsupported
    ? `Durées grisées : ${provider.name} ne fournit pas de données réelles à cette granularité.`
    : '';
}

// ---------- Rendu des résultats ----------

function voteClass(v) {
  if (!v.active) return { cls: 'neutral', arrow: '–' };
  if (v.vote > 0.1) return { cls: 'up', arrow: '▲' };
  if (v.vote < -0.1) return { cls: 'down', arrow: '▼' };
  return { cls: 'neutral', arrow: '●' };
}

function detailBlock(e) {
  const bt = e.backtest;
  let btText;
  if (!bt || bt.n === 0) {
    btText = 'Backtest : aucun signal non neutre sur les bougies chargées, donc aucune précision mesurable.';
  } else if (bt.n < 30) {
    btText = `Backtest : seulement ${bt.n} signaux sur les ${e.bars} bougies chargées — trop peu pour conclure.`;
  } else {
    btText = `Backtest : sur les ${e.bars} dernières bougies chargées, ce moteur a désigné le bon sens de la bougie suivante ${Math.round(bt.rate * 100)} % du temps (${bt.hits}/${bt.n} signaux ; intervalle à 95 % : ${Math.round(bt.low * 100)} à ${Math.round(bt.high * 100)} %).`;
  }
  const closeTs = e.lastCandleT + e.intervalSec * 1000;

  return h('div', { class: 'detail' },
    h('dl', { class: 'meta' },
      h('dt', { text: 'Actif' }), h('dd', { text: e.assetLabel }),
      h('dt', { text: 'Durée' }), h('dd', { text: e.intervalLabel }),
      h('dt', { text: 'Heure de l’analyse' }), h('dd', { text: fmtTime(e.ts) }),
      h('dt', { text: 'Source' }), h('dd', { text: e.providerName }),
      h('dt', { text: 'Dernière bougie clôturée' }), h('dd', { text: fmtTime(closeTs) }),
      h('dt', { text: 'Dernier prix' }), h('dd', { text: String(e.price) }),
    ),
    h('h3', { text: 'Explication des indicateurs' }),
    h('ul', { class: 'ind' },
      e.votes.map((v) => {
        const { cls, arrow } = voteClass(v);
        return h('li', { class: 'ind-row' },
          h('span', { class: `dot ${cls}`, text: arrow, 'aria-hidden': 'true' }),
          h('div', {}, h('strong', { text: v.label }), h('p', { text: v.text })),
        );
      }),
    ),
    h('p', { class: 'vol', text: e.volatility }),
    h('p', { class: 'bt', text: btText }),
  );
}

function resultCard(e) {
  const v = VERDICT[e.verdict];
  return h('article', { class: `res ${v.cls}` },
    h('div', { class: 'verdict' }, h('span', { class: 'arrow', text: v.arrow, 'aria-hidden': 'true' }), h('span', { text: v.label })),
    h('div', { class: 'conf' },
      h('div', { class: 'conf-top' }, h('span', { text: 'Confiance statistique' }), h('strong', { text: `${e.confidence} %` })),
      h('div', { class: 'bar', role: 'presentation' }, h('i', { style: `width:${e.confidence}%` })),
    ),
    h('p', { class: 'note', text: 'Convergence pondérée des indicateurs sur les données chargées. Ce n’est pas une probabilité de gain.' }),
    e.staleSec != null && h('p', { class: 'warn', text: `Données non fraîches : la dernière bougie clôturée date d’il y a ${fmtAge(e.staleSec)} (marché fermé ou source en retard ?). Cette indication ne reflète pas le marché actuel.` }),
    detailBlock(e),
  );
}

function showInResult(node) {
  $('result').replaceChildren(node);
}

function renderError(message) {
  showInResult(h('div', { class: 'err' }, h('strong', { text: 'Analyse impossible' }), h('p', { text: message })));
}

function renderHistory() {
  const list = $('historyList');
  list.replaceChildren();
  const items = loadHistory().filter((e) => e && VERDICT[e.verdict] && Array.isArray(e.votes));
  $('clearHistory').hidden = items.length === 0;
  if (!items.length) {
    list.append(h('li', { class: 'empty', text: 'Aucune analyse pour le moment.' }));
    return;
  }
  for (const e of items) {
    const v = VERDICT[e.verdict];
    list.append(
      h('li', {},
        h('details', { class: `hist ${v.cls}` },
          h('summary', {},
            h('span', { class: 'h-top' },
              h('span', { class: 'h-verdict', text: `${v.arrow} ${v.short}` }),
              h('span', { class: 'h-conf', text: `${e.confidence} %` }),
            ),
            h('span', { class: 'h-sub', text: `${e.assetLabel} · ${e.intervalLabel} · ${fmtTime(e.ts)}` }),
          ),
          detailBlock(e),
        ),
      ),
    );
  }
}

// ---------- Analyse ----------

async function predict() {
  if (state.busy) return;
  const asset = ASSETS.find((a) => a.key === state.assetKey);
  const dur = DURATIONS.find((d) => d.sec === state.intervalSec);
  const provider = asset.provider;

  state.busy = true;
  const btn = $('predict');
  btn.disabled = true;
  btn.textContent = 'ANALYSE EN COURS…';
  showInResult(h('div', { class: 'loading' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), `Chargement des bougies réelles ${asset.label} (${dur.label})…`));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const candles = await provider.fetchCandles({
      symbol: asset.symbol, intervalSec: dur.sec, target: TARGET_CANDLES,
      settings: loadSettings(), signal: ctrl.signal,
    });
    const ind = computeIndicators(candles);
    const ev = evaluateAt(ind, candles, candles.length - 1);
    if (!ev.ok) throw new Error(ev.reason);
    const bt = backtest(ind, candles, 1);

    const ts = Date.now();
    const lastT = candles[candles.length - 1].t;
    const ageSec = (ts - (lastT + dur.sec * 1000)) / 1000;
    const entry = {
      id: `${ts}${Math.random().toString(36).slice(2, 6)}`,
      ts,
      assetKey: asset.key, assetLabel: asset.label,
      intervalSec: dur.sec, intervalLabel: dur.label,
      providerName: provider.name,
      verdict: ev.verdict, confidence: ev.confidence,
      price: ev.price, lastCandleT: lastT, bars: candles.length,
      votes: ev.votes.map(({ label, vote, active, text }) => ({ label, vote, active, text })),
      volatility: ev.volatility.text,
      backtest: { n: bt.n, hits: bt.hits, rate: bt.rate, low: bt.low, high: bt.high },
      staleSec: ageSec > 3 * dur.sec + 60 ? ageSec : null,
    };
    addHistory(entry);
    showInResult(resultCard(entry));
    renderHistory();
  } catch (err) {
    renderError(err.name === 'AbortError'
      ? 'Délai dépassé : la source de données ne répond pas. Vérifiez votre connexion et réessayez.'
      : (err.message || 'Erreur inconnue.'));
  } finally {
    clearTimeout(timer);
    state.busy = false;
    btn.disabled = false;
    btn.textContent = 'PRÉDICTION';
  }
}

// ---------- Réglages & installation ----------

let deferredInstall = null;

function setupSettings() {
  const dlg = $('settings');
  $('settingsBtn').addEventListener('click', () => {
    $('tdKey').value = loadSettings().twelveDataKey ?? '';
    dlg.showModal();
  });
  $('saveSettings').addEventListener('click', () => saveSettings({ twelveDataKey: $('tdKey').value.trim() }));
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $('installBtn').hidden = true;
  });
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferredInstall = ev;
    $('installBtn').hidden = false;
  });
}

// ---------- Démarrage ----------

async function init() {
  // Le catalogue OTC est récupéré depuis le serveur : il suit les instruments réellement exposés par le fournisseur.
  try {
    ASSETS = await refreshProviderAssets();
  } catch (err) {
    // Les cinq instruments de secours restent visibles ; l'analyse OTC affichera l'erreur de configuration si nécessaire.
    console.warn('Actualisation du catalogue OTC impossible :', err.message);
    ASSETS = listAssets();
  }
  const s = loadSettings();
  state.assetKey = ASSETS.some((a) => a.key === s.assetKey) ? s.assetKey : ASSETS[0].key;
  state.intervalSec = DURATIONS.some((d) => d.sec === s.intervalSec) ? s.intervalSec : 60;

  buildAssetSelect();
  refreshDurations();
  renderHistory();
  setupSettings();

  $('predict').addEventListener('click', predict);
  $('clearHistory').addEventListener('click', () => {
    if (confirm('Effacer tout l’historique des analyses ?')) {
      clearHistory();
      renderHistory();
    }
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
