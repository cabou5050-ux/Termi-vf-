# Mise à jour — intégration multi-marchés

- Extension du catalogue Twelve Data : paires Forex, matières premières, actions, indices et cryptomonnaies.
- Conservation de Binance pour les cryptomonnaies spot et d'OTCharts pour le catalogue OTC Pocket Option autorisé par la clé serveur.
- Validation de la granularité demandée et du nombre minimal de bougies clôturées avant calcul.
- Messages d'erreur plus explicites lorsque le fournisseur ne donne pas accès à un symbole.

Limites : la liste proposée n'est pas une garantie d'accès chez Twelve Data. L'accès réel dépend du forfait, de l'exchange et du symbole exact. Le catalogue OTC complet dépend des droits OTCharts. Pocket Option ne fournit pas d'API publique officielle de cotations dans cette application ; aucun prix n'est simulé et aucun ordre n'est passé.
