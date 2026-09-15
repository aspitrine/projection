# Gabarit d'un bounded context

Règles et rationale : [ADR 0001](../adr/0001-architecture-ddd-effect.md). Exemple vivant : `packages/platform` (contrat `SystemRpcs`).

## Arborescence

```
packages/<contexte>/
  package.json
  tsconfig.json
  src/
    domain/            # Schema.Class, erreurs Schema.TaggedError, fonctions pures
    application/       # cas d'usage (Effect.fn) et ports (Context.Service)
    infrastructure/    # adapters : repositories SQL, parsers, clients externes
    api/
      contract.ts      # RpcGroup + schémas exposés — importable côté client
      handlers.ts      # <Contexte>Rpcs.toLayer(...)
    migrations/
      index.ts         # Record<"<id>_<nom>", Effect> pour Migrator.fromRecord
      0001_<nom>.ts
    server.ts          # Layer complet du contexte (handlers + adapters)
  test/
    *.test.ts          # domaine : pur ; application : Layers en mémoire
    *.integration.test.ts  # adapters SQL : Postgres réel, ignorés sans DATABASE_URL
```

## `package.json`

```json
{
  "name": "@projection/<contexte>",
  "private": true,
  "type": "module",
  "exports": {
    "./contract": "./src/api/contract.ts",
    "./domain": "./src/domain/index.ts",
    "./server": "./src/server.ts"
  },
  "scripts": { "check-types": "tsc --noEmit" },
  "dependencies": {
    "@projection/shared-kernel": "workspace:*",
    "effect": "catalog:"
  },
  "devDependencies": {
    "@effect/vitest": "catalog:",
    "@projection/config": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

`apps/web` n'importe côté client que `./contract` (et éventuellement `./domain` s'il est pur).

## Branchement dans l'application

1. **Contrat** — `apps/web/src/api/contract.ts` : `ApiRpcs = SystemRpcs.merge(<Contexte>Rpcs)`.
2. **Serveur** — `apps/web/src/server/api.ts` : ajouter le Layer du contexte à `HandlersLive`, et ses migrations à `layerMigrations([{ context: "<contexte>", migrations }])`.
3. **Client** — `ApiClient.query("<Tag>", payload)` / `ApiClient.mutation("<Tag>")` dans `apps/web/src/features/<contexte>/`.

## Conventions

- Identifiant de service : `"@projection/<contexte>/<Service>"`.
- Toute requête SQL filtre par `organizationId` issu de `CurrentActor`.
- Erreurs métier déclarées dans le `error` des `Rpc.make` ; les erreurs d'infrastructure deviennent des défauts (`Effect.orDie`) sauf si le client doit pouvoir y réagir.
- Tables préfixées par le contexte si ambiguïté (`song_section`, `bible_verse`), table de migrations `<contexte>_migrations`.
