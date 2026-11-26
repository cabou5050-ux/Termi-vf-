// Stockage local (localStorage) : réglages et historique des analyses.
// Tout reste sur l'appareil ; aucune donnée n'est envoyée à un serveur.

const KEY_HISTORY = 'ttp.history.v1';
const KEY_SETTINGS = 'ttp.settings.v1';
const MAX_HISTORY = 200;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadSettings = () => ({ twelveDataKey: '', assetKey: null, intervalSec: 60, ...read(KEY_SETTINGS, {}) });
export const saveSettings = (patch) => write(KEY_SETTINGS, { ...loadSettings(), ...patch });

export function loadHistory() {
  const h = read(KEY_HISTORY, []);
  return Array.isArray(h) ? h : [];
}

export function addHistory(entry) {
  const h = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  write(KEY_HISTORY, h);
  return h;
}

export const clearHistory = () => write(KEY_HISTORY, []);
