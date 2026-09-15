# ADR 0001 — Architecture DDD par feature avec Effect 4

- **Statut** : accepté
- **Date** : 2026-09-15

## Contexte

Le projet a été généré avec Better-T-Stack (oRPC, Drizzle, Zod, TanStack Query). On veut :

- une organisation du code **par feature** suivant le **DDD** (bounded contexts, domaine isolé de l'infrastructure) ;
- utiliser **Effect au maximum** : erreurs typées, injection de dépendances, streams temps réel, schémas partagés client/serveur.

Effect 4 est en release candidate (`4.0.0-rc.115`). `platform`, `rpc`, `sql`, `reactivity` y sont intégrés au package `effect` sous `effect/unstable/*`.

## Décision

### Stack

| Besoin                 | Avant                         | Après                                                                                        |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| Runtime applicatif     | —                             | `effect@4` (rc, version épinglée)                                                            |
| API client/serveur     | oRPC                          | `effect/unstable/rpc` (`RpcGroup`, `RpcServer`, `RpcClient`), sérialisation NDJSON sur HTTP  |
| Temps réel             | —                             | RPC `stream: true` + `PubSub` / `SubscriptionRef` côté serveur                               |
| Base de données        | Drizzle                       | `@effect/sql-pg` (`PgClient`) + `effect/unstable/sql` (`SqlSchema`, `Migrator`)              |
| Validation / modèles   | Zod                           | `effect/Schema`                                                                              |
| État client / fetching | TanStack Query                | `effect/unstable/reactivity` (`AtomRpc`) + `@effect/atom-react`                              |
| Tests                  | Vitest                        | Vitest + `@effect/vitest`                                                                    |
| Auth                   | better-auth (adapter Drizzle) | better-auth (pool `pg` natif + plugin `organization`), encapsulé dans le contexte `identity` |
| Routing / SSR          | TanStack Start                | inchangé ; l'API Effect est montée via `HttpRouter.toWebHandler` sur `/api/rpc`              |
| Env                    | varlock                       | varlock (génération `.env`) + `effect/Config` à la lecture                                   |

Toutes les versions `effect` / `@effect/*` sont épinglées sur la même rc via le catalog Bun.

### Bounded contexts

| Contexte      | Package                     | Responsabilité                                                                  |
| ------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Shared kernel | `@projection/shared-kernel` | IDs brandés, `CurrentActor`, erreurs transverses                                |
| Platform      | `@projection/platform`      | Layers d'infra : `PgClient`, migrations, S3 (Garage), config, observabilité     |
| Identity      | `@projection/identity`      | Organisations, membres, rôles, adaptation better-auth, middleware RPC d'auth    |
| Songs         | `@projection/songs`         | Chants, sections, ordres de passage, imports (VideoPsalm, OpenLyrics, ChordPro) |
| Bible         | `@projection/bible`         | Traductions, versets, parsing de références, recherche                          |
| Media         | `@projection/media`         | Images, vidéos, stockage S3                                                     |
| Slides        | `@projection/slides`        | Diapos texte et mises en page                                                   |
| Presentation  | `@projection/presentation`  | Modèle `Slide`, moteur de découpage, thèmes — **pur**, partagé client/serveur   |
| Projects      | `@projection/projects`      | Projets et éléments                                                             |
| Outputs       | `@projection/outputs`       | Sorties, tokens d'accès, thème par sortie                                       |
| Live          | `@projection/live`          | Session live, pistes Salle/Stream, diffusion temps réel                         |

### Structure d'un contexte

```
packages/songs/
  src/
    domain/            # Schema.Class (entités, value objects), erreurs taguées, règles pures
    application/       # cas d'usage (Effect.fn), ports (Context.Service)
    infrastructure/    # adapters : SqlSongRepository, VideoPsalmParser…
    api/
      contract.ts      # RpcGroup + schémas — seul fichier importable côté client
      handlers.ts      # implémentation du RpcGroup (Layer)
    migrations/        # migrations SQL propres au contexte
    server.ts          # façade serveur : Layer complet du contexte
  test/
  package.json         # exports "./contract", "./domain", "./server"
```

Côté web :

```
apps/web/src/
  routes/              # routes TanStack fines, délèguent aux features
  features/<contexte>/ # composants, atoms, hooks du contexte
  server/              # composition root : assemble les Layers, monte /api/rpc
```

### Règles

1. **Sens des dépendances** : `domain` ← `application` ← `infrastructure` / `api`. Le domaine n'importe ni SQL, ni HTTP, ni React.
2. **Pas d'import entre internals de contextes.** Un contexte ne consomme un autre que via son `contract`, ou via un **port** déclaré chez lui et implémenté dans la composition root. Exemple : `live` déclare `SlideSource`, implémenté dans `apps/web/src/server` avec `songs`, `bible` et `slides`.
3. **Références inter-contextes par ID** (`SongId`, `VerseRange`…) définis dans le shared kernel, jamais par jointure d'objets.
4. **Multi-tenant** : un middleware RPC fournit `CurrentActor` (user, organisation, rôle). Les repositories filtrent systématiquement par `organizationId`.
5. **Erreurs** : erreurs métier taguées via `Schema`, déclarées dans les contrats RPC, donc typées jusqu'au client.
6. **Tests** : domaine testé en pur ; cas d'usage testés avec des Layers en mémoire ; adapters SQL testés sur Postgres réel (docker compose).

## Conséquences

- ➕ Erreurs et dépendances visibles dans les types, streams temps réel natifs, un seul langage de schéma client/serveur.
- ➕ Frontières de contextes appliquées par les dépendances de packages.
- ➖ API `unstable/*` susceptible de bouger avant Effect 4.0 final : versions épinglées, montée de version groupée.
- ➖ Réécriture du socle généré (oRPC, Drizzle, Zod, TanStack Query retirés) avant toute feature.
- ➖ Courbe d'apprentissage Effect pour les contributeurs.
- ⚠️ À valider par spike : streaming NDJSON des RPC à travers TanStack Start / Nitro en build Docker (repli : WebSocket via `RpcServer` socket protocol).
