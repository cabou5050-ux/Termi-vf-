# Mise à jour — catalogue OTC dynamique

- Le menu OTC interroge désormais le catalogue Pocket Option du fournisseur OTCharts (`/v1/symbols?venue=otc`).
- Les instruments disponibles sont actualisés côté serveur et mis en cache pendant cinq minutes.
- Le serveur vérifie qu'un symbole demandé appartient au catalogue avant de transmettre la requête de bougies.
- Intervalles OTC pris en charge selon la documentation du fournisseur : 5, 15, 30 secondes ; 1, 2, 3, 5, 10, 15, 30 minutes ; 1 et 4 heures.
- Les autres sources (Binance et Twelve Data) conservent leurs intervalles compatibles.
- La clé OTCharts reste exclusivement dans la variable d'environnement `OTCHARTS_API_KEY`.

Important : le catalogue complet dépend du forfait et des droits de la clé OTCharts. Le forfait gratuit est limité à cinq instruments. Cette modification ne transforme pas les cours OTC en cours Forex réels et ne constitue pas une API officielle Pocket Option.
