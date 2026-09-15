# ADR 0002 — Temps réel : RPC Effect en streaming NDJSON sur HTTP

- **Statut** : accepté
- **Date** : 2026-09-15
- **Spike** : T0.2 — `packages/live`, page `/spike/live`, scripts `apps/web/scripts/live-latency.ts` et `live-watch.ts` (retirés en T1.8, remplacés par la régie)

## Contexte

La régie et les sorties doivent partager l'état de la session live en temps réel, avec plusieurs opérateurs. L'API est en Effect RPC montée dans TanStack Start / Nitro (ADR 0001). Question : le streaming NDJSON sur HTTP suffit-il, ou faut-il des WebSockets ?

## Décision

**Streaming RPC NDJSON sur HTTP** (`RpcServer.layerHttp({ protocol: "http" })`, `RpcSerialization.layerNdjson`), sans WebSocket.

Modèle :

- **Serveur autoritaire** : l'état vit dans un `SubscriptionRef` (un par session). Les commandes (`LiveGoTo`, `LiveToggleBlackout`) sont des RPC classiques qui renvoient le nouvel état.
- **Abonnement** : `LiveWatch` (`stream: true`) émet **l'état courant puis chaque changement** (`SubscriptionRef.changes`). On diffuse des états complets, pas des deltas.
- **Resynchronisation gratuite** : tout (ré)abonnement commence par l'état complet. Le client n'a aucune logique de rattrapage.
- **Client** : atom construit sur le stream, avec `Stream.retry` (erreur réseau) et `Stream.repeat` (fin de flux propre), toutes les secondes.

## Résultats du spike

| Mesure                                                          | Dev (Vite)                     | Docker (node-server)                                                                                       |
| --------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Mutation → événement reçu par un autre abonné (p50 / p95 / max) | 2,5 / 4,1 / 8,2 ms (50 essais) | 1,6 / 2,7 / 9,3 ms (100 essais)                                                                            |
| Deux onglets synchronisés                                       | ✅ ~2 ms                       | ✅                                                                                                         |
| Nouvel abonné reçoit l'état complet                             | ✅                             | ✅                                                                                                         |
| Flux inactif ouvert 6,5 min                                     | —                              | ⚠️ coupé à 360 s (`RpcClientError`), réabonné en 1 s avec l'état complet                                   |
| Conteneur recréé, deux onglets ouverts                          | —                              | ✅ reconnexion sans rechargement, état resynchronisé (v0, état en mémoire), synchro entre onglets rétablie |

Objectif < 200 ms largement atteint.

## Conséquences

- ➕ Aucune infrastructure supplémentaire : même route `/api/rpc`, même sérialisation, fonctionne derrière n'importe quel reverse proxy HTTP.
- ➕ Diffuser l'état complet rend le client trivial et robuste (pas de deltas perdus).
- ➖ Un flux inactif est coupé au bout de 6 min (origine non isolée : timeout du serveur Node, du client fetch Bun ou du port-forwarding Docker). Sans impact grâce au réabonnement, mais **T1.8** ajoutera un battement de cœur applicatif (ré-émission périodique de l'état) pour détecter plus tôt une connexion morte côté sortie.
- ➖ Chaque abonnement garde une requête HTTP ouverte : prévoir la désactivation du buffering sur les reverse proxies (`X-Accel-Buffering: no` / `proxy_buffering off` pour nginx) dans la doc de déploiement.
- ➖ États complets : acceptable tant que l'état live reste petit (quelques Ko). Si l'état grossit, émettre un état « vue » par sortie plutôt que des deltas.
- ➖ État en mémoire dans le spike : perdu au redémarrage. **T1.8** persiste l'état en Postgres ; **T3.3** diffuse entre instances via `LISTEN/NOTIFY`.
- Repli WebSocket (`RpcServer` protocole socket) inutile à ce stade ; envisageable si un proxy cible ne supporte pas les réponses HTTP longues.
