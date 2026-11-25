# TERMINATOR TRADING PRÉDICTION

Application web mobile (PWA) d'analyse technique. Elle télécharge de **vraies bougies de marché**, calcule RSI, MACD, EMA, chandeliers japonais, tendance, volatilité et momentum, puis affiche une indication **haussière / baissière / neutre** avec une explication de chaque indicateur et un historique des analyses.

- Interface PWA avec petit serveur Node.js : nécessaire pour garder la clé OTCharts secrète et relayer les requêtes OTC. Aucune base de données.
- Fond noir, texte blanc, vert = haussier, rouge = baissier, boutons larges pour les doigts.
- Installable sur l'écran d'accueil iPhone et Android.

---

## 1. Ce qu'il faut savoir avant de l'utiliser (honnêteté)

**Pocket Option.** Pocket Option ne propose pas d'API publique de données de marché. L'application n'est donc **pas connectée à Pocket Option** et ne prétend pas l'être. Elle utilise des sources publiques réelles :

| Source | Actifs | Granularité | Clé |
|---|---|---|---|
| Binance (spot) | 12 cryptos (BTC, ETH, SOL…) | 1 s → 30 min (les durées 5/10/15/30 s sont reconstruites à partir de vraies bougies d'1 seconde) | Aucune |
| Twelve Data | Forex, matières premières, actions, indices et cryptos classiques (catalogue étendu) | 1 min → 30 min | Clé personnelle (Réglages ⚙), selon les droits du forfait |
| OTCharts | Catalogue OTC Pocket Option récupéré dynamiquement (devises, matières premières, actions, cryptos et indices, selon les droits de la clé) | 5 s à 4 h selon les intervalles réellement servis | Clé OTCharts côté serveur |

Le mode OTC utilise un fournisseur tiers indépendant, OTCharts, et non une API officielle de Pocket Option. Il lit les bougies et prix, mais ne passe aucun ordre. Vérifiez toujours que les symboles OTC sont disponibles dans le catalogue de votre compte et comparez les cotations avec Pocket Option. La disponibilité et l'exactitude du flux dépendent du fournisseur.

**Le « pourcentage de confiance » n'est pas une probabilité de gain.** C'est la part pondérée des indicateurs qui vont dans le même sens que le verdict (atténuée si la volatilité est anormale). Pour donner une mesure réelle, l'application ajoute un **backtest** : sur les bougies chargées, combien de fois ce même moteur a désigné le bon sens de la bougie suivante, avec son intervalle de confiance à 95 % et le nombre de signaux. Sur des durées très courtes, attendez-vous à des résultats proches de 50 % : c'est normal, le très court terme est quasi aléatoire. Aucune analyse technique ne garantit un résultat. Les options binaires et le trading comportent un risque élevé de perte en capital.

**Si une source est indisponible**, l'application affiche une erreur claire : elle ne génère jamais de données de remplacement. Si le marché est fermé (forex le week-end), elle signale que les données ne sont pas fraîches.

---

## 2. Lancer en local

Prérequis : Node.js 18 ou plus récent.

```bash
cd terminator-trading-prediction
npm start          # puis ouvrez http://localhost:8080
npm test           # 14 tests du moteur (indicateurs, chandeliers, backtest, agrégation)
```

Sans Node : `python3 -m http.server 8080` dans le dossier fonctionne aussi.
Les modules JavaScript exigent un serveur HTTP : ouvrir `index.html` directement (file://) ne marche pas.

---

## 3. Déploiement (gratuit, HTTPS obligatoire pour l'installation PWA)

Le dossier est un site statique : tous les chemins sont relatifs, il fonctionne à la racine d'un domaine **ou** dans un sous-dossier.

### Option A : Cloudflare Pages (recommandé)
1. Créez un compte sur cloudflare.com, puis **Workers & Pages → Create → Pages → Upload assets**.
2. Nommez le projet, glissez-déposez le **contenu** du dossier (ou son ZIP décompressé), puis **Deploy**.
3. Votre adresse `https://nom-du-projet.pages.dev` est prête.

### Option B : Netlify
1. Sur app.netlify.com : **Add new site → Deploy manually**.
2. Glissez-déposez le dossier du projet. L'adresse HTTPS est créée immédiatement.

### Option C : GitHub Pages
1. Créez un dépôt GitHub et envoyez-y tous les fichiers (à la racine du dépôt).
2. **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**.
3. Après une minute : `https://votre-compte.github.io/nom-du-depot/`.

### Option D : Render (serveur Node + mode OTC)
1. Envoyez tous les fichiers du projet à la racine d’un dépôt GitHub.
2. Sur Render, choisissez **New → Blueprint** et connectez ce dépôt. Render détectera `render.yaml` et préparera le service web.
3. Dans les variables d’environnement du service, ajoutez `OTCHARTS_API_KEY` avec votre clé OTCharts (ne la mettez jamais dans GitHub).
4. Lancez le déploiement. Vérifiez que `https://votre-service.onrender.com/health` répond `status: ok`.
5. Ouvrez ensuite l’adresse HTTPS du service sur votre iPhone avec Safari.

Le service Render gratuit peut s’endormir après une période sans activité ; le premier chargement suivant peut donc être lent. Le mode OTC exige ce serveur Node : un hébergement purement statique ne peut pas exécuter le proxy.

### Option D : Vercel
1. Sur vercel.com : **Add New → Project**, importez le dépôt (ou utilisez `npx vercel` dans le dossier).
2. Framework : **Other**, aucune commande de build, dossier de sortie : racine.

Mises à jour : redéployez les fichiers. Le service worker récupère toujours la version la plus récente quand le téléphone est en ligne.

---

## 4. Installation sur le téléphone

Ouvrez d'abord votre adresse HTTPS déployée.

**iPhone (Safari obligatoire)**
1. Touchez le bouton **Partager** (carré avec une flèche vers le haut).
2. Faites défiler et touchez **Sur l'écran d'accueil**.
3. Touchez **Ajouter**. L'icône Terminator apparaît ; l'app s'ouvre en plein écran.

**Android (Chrome)**
1. Touchez le menu **⋮** en haut à droite.
2. Touchez **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. Confirmez. Un bouton « Installer l'application » est aussi proposé dans ⚙ Réglages quand Chrome le permet.

### Activer les marchés classiques
1. Créez un compte Twelve Data et copiez votre clé API.
2. Dans l'app : ⚙ → collez la clé → **Enregistrer**. Elle reste dans le stockage local de votre téléphone.
3. Le sélecteur propose désormais des paires Forex, matières premières, actions, indices et cryptomonnaies. Les instruments effectivement accessibles dépendent du catalogue et du forfait Twelve Data ; une erreur du fournisseur signifie que le symbole ou la granularité n'est pas autorisé/disponible.

### Activer Pocket Option OTC (serveur Node requis)
1. Créez une clé OTCharts et choisissez le marché Pocket Option / `otc` dans les réglages de votre compte OTCharts.
2. Sur l'hébergeur Node qui exécute `server.js`, ajoutez une variable d'environnement nommée `OTCHARTS_API_KEY` et collez-y la clé comme valeur secrète.
3. Redémarrez / redéployez le serveur. Dans Terminator, choisissez un actif dans le groupe « Pocket Option — actifs OTC ».
4. Le menu OTC est alimenté automatiquement par le catalogue autorisé par votre clé. Pour obtenir tous les instruments, votre forfait OTCharts doit ouvrir l'ensemble du book Pocket Option. Ne placez jamais la clé OTCharts dans le JavaScript du navigateur, dans le dépôt public ou dans une capture d'écran.

Le catalogue OTC est chargé dynamiquement depuis `/v1/symbols?venue=otc` et mis en cache cinq minutes côté serveur. OTCharts précise que les horodatages Pocket Option OTC suivent une horloge UTC+2 ; le fournisseur retire deux heures avant de normaliser les bougies en UTC. Le nombre d'instruments accessibles dépend du forfait OTCharts : le niveau gratuit ne donne accès qu'à cinq instruments, tandis que le catalogue complet nécessite un forfait ouvrant tout le book Pocket Option. Chaque demande d'historique consomme une requête. Consultez les limites de votre compte avant les essais. Les hébergements purement statiques (Cloudflare Pages en mode statique, Netlify Drop, GitHub Pages) ne peuvent pas exécuter ce proxy Node : le mode OTC y restera indisponible tant qu'un backend n'est pas déployé.

---

## 5. Comment fonctionne le moteur

Chaque indicateur émet un vote de −1 (baissier) à +1 (haussier) ; le score est la moyenne pondérée des votes actifs. Verdict : haussier si score > 0,15 ; baissier si < −0,15 ; sinon neutre.

| Indicateur | Poids | Logique |
|---|---|---|
| RSI (14, Wilder) | 1,0 | Surachat > 70 (baissier), survente < 30 (haussier), sinon pression et pente sur 3 bougies |
| MACD (12, 26, 9) | 1,3 | Niveau de l'histogramme (en multiples d'ATR) et sa direction |
| EMA 9 / 21 / 50 | 1,3 | Alignement des moyennes et position du prix par rapport à l'EMA 21 |
| Chandeliers | 0,8 | Avalements, marteau, étoile filante, étoiles du matin/soir, trois soldats/corbeaux, marubozu, doji (ignoré si aucun motif) |
| Tendance | 1,2 | Régression linéaire sur 20 bougies : pente en ATR × qualité (R²) |
| Momentum (10) | 0,9 | Variation sur 10 bougies en multiples d'ATR |
| Volatilité | — | Non directionnelle : ATR et largeur des bandes de Bollinger vs médiane récente ; réduit la confiance si anormale (×0,8 à ×0,9, ×0,85 en compression) |

- **Confiance** = part du poids des indicateurs d'accord avec le verdict × facteur de volatilité. Pour « NEUTRE », elle mesure l'équilibre entre forces opposées.
- **Données** : 150 bougies clôturées ; la bougie en cours n'est jamais utilisée. Minimum 61 bougies, sinon l'analyse est refusée.
- **Backtest** : marche avant, sans fuite du futur (testé), sur les mêmes bougies. Les signaux successifs se chevauchent : l'intervalle à 95 % est donc indicatif.
- Les pondérations et seuils sont des choix d'ingénierie documentés (`js/engine.js`), pas des valeurs optimisées sur des profits passés.

---

## 6. Brancher une autre source de données réelle

1. Copiez `js/providers/_template.js` vers `js/providers/ma-source.js` et adaptez `fetchCandles` (format de bougie : `{ t, o, h, l, c, v }`, bougies clôturées, ordre croissant).
2. Ajoutez-la à la liste `PROVIDERS` dans `js/providers/index.js`.
3. Ses actifs et les durées qu'elle supporte apparaissent automatiquement dans l'interface (les durées non supportées sont grisées).

La source doit autoriser le CORS depuis un navigateur ; sinon, passez par un petit proxy à vous.

---

## 7. Portée de l’intégration multi-marchés

Le catalogue OTC provient du fournisseur OTCharts et peut contenir les devises, matières premières, actions, cryptos et indices qu’il autorise. Les marchés classiques sont proposés via Twelve Data ; Binance fournit en complément ses paires crypto spot. Il n’existe pas de connexion officielle à Pocket Option dans cette application. La liste des actifs Pocket Option varie selon l’heure, le compte et le taux de paiement ; le calendrier officiel sert de référence, mais ne fournit pas à lui seul l’historique OHLC nécessaire à une analyse. Un actif affiché n’est analysable que si sa source renvoie suffisamment de bougies réelles.

## 8. Structure du projet

```
index.html                  page unique
css/style.css               thème noir, responsive
js/app.js                   interface, historique, réglages
js/engine.js                agrégation des votes, confiance, backtest
js/indicators.js            EMA, RSI, MACD, ATR, Bollinger, momentum, régression
js/candles.js               motifs de chandeliers
js/storage.js               historique (200 analyses max) et réglages, en local
js/providers/               sources de données (binance, twelvedata, util, _template)
sw.js, manifest.webmanifest PWA (installation, ouverture hors ligne de l'interface)
icons/                      icônes
tests/engine.test.js        tests automatiques
server.js                   serveur local de test
```

Confidentialité : l'historique et la clé API restent dans le navigateur de l'appareil. Aucune statistique, aucun traceur ; les seuls appels réseau sont ceux vers Binance / Twelve Data.
