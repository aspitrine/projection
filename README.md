# Projection

Logiciel de vidéo-projection web et auto-hébergeable (chants, versets bibliques, diapos, sorties salle / retour / stream).

- Produit : [docs/PRD.md](docs/PRD.md) · Tâches : [TASKS.md](TASKS.md)
- Architecture : [ADR 0001 — DDD par feature + Effect 4](docs/adr/0001-architecture-ddd-effect.md) · [ADR 0002 — Temps réel](docs/adr/0002-temps-reel.md) · [Gabarit de contexte](docs/architecture/gabarit-contexte.md) · [i18n](docs/architecture/i18n.md)

## Stack

- **TanStack Start** — SSR et routing
- **Effect 4** — RPC (`effect/unstable/rpc`), SQL (`@effect/sql-pg`), Schema, Atom (`@effect/atom-react`)
- **PostgreSQL** — base de données, migrations Effect par bounded context
- **Better-Auth** — authentification et organisations
- **Paraglide JS** — i18n (français)
- **Vite+** — toolchain, lint, format ; **Vitest 5** + `@effect/vitest` pour les tests

## Démarrage

Base de développement : **Postgres de l'hôte** (ex. Postgres.app), un rôle et une base dédiés.

```bash
psql -d postgres -c "CREATE ROLE projection LOGIN PASSWORD '<mot-de-passe>'" -c "CREATE DATABASE projection OWNER projection"
```

Renseigner `DATABASE_URL=postgresql://projection:<mot-de-passe>@localhost:5432/projection` dans `apps/web/.env`, puis :

```bash
bun install
bun run dev
```

Les migrations (better-auth et contextes) s'appliquent au premier appel de l'API. Ouvrir [http://localhost:3001](http://localhost:3001).

Le service `postgres` de `docker-compose.yml` sert au déploiement auto-hébergé (`bun run docker:up`). En local il reste utilisable via `bun run db:start` (`POSTGRES_PORT` pour changer le port hôte).

## Tests

```bash
bun run test
```

Les tests d'intégration Postgres (`*.integration.test.ts`) ne tournent que si `DATABASE_URL` est défini :

```bash
bun run test:integration
```

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@projection/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `bun run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

## Deployment

### Docker Compose

- Target: web + postgres
- Config: `docker-compose.yml` (app Dockerfiles live in `apps/*/Dockerfile`)
- Build images: bun run docker:build
- Start: bun run docker:up
- Logs: bun run docker:logs
- Stop: bun run docker:down

Environment variables are read from each app's `.env` file (baked into web builds for public variables) and overridden in `docker-compose.yml` for container networking.

For more details, see the guide on [Deploying with Docker Compose](https://www.better-t-stack.dev/docs/guides/docker).

## Git Hooks and Formatting

- Optional native Vite+ hooks: `bun run hooks:setup`
- Docs: [Vite+ commit hooks](https://viteplus.dev/guide/commit-hooks)
- Run checks: `bun run check`

## Project Structure

```
projection/
├── apps/
│   └── web/              # TanStack Start : routes, features UI, composition root (src/server)
├── packages/
│   ├── shared-kernel/    # IDs brandés, CurrentActor
│   ├── platform/         # Postgres, migrations, logs, RPC système
│   ├── identity/         # Organisations, membres, rôles, Better-Auth, middleware CurrentActor
│   ├── live/             # Session live temps réel (spike T0.2)
│   ├── ui/               # Composants shadcn/ui partagés
│   └── config/           # tsconfig partagé
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run check-types`: Check TypeScript types across all apps
- `bun run test`: Run Vitest (unit + integration when `DATABASE_URL` is set)
- `bun run db:start` / `db:stop` / `db:down`: Manage the Postgres container (`POSTGRES_PORT` to change the host port)
- `bun run check`: Run Vite+ format/lint checks and workspace TypeScript checks
- `bun run lint`: Run Vite+ lint checks
- `bun run format`: Run Vite+ formatting
- `bun run staged`: Run Vite+ checks against staged files
- `bun run hooks:setup`: Install Vite+ native Git hooks with `vp config`
- `bun run docker:build`: Build the Docker Compose images
- `bun run docker:up`: Build and start the Docker Compose stack
- `bun run docker:logs`: Tail logs from the Docker Compose stack
- `bun run docker:down`: Stop the Docker Compose stack
