FROM node:24 AS builder
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY . .
RUN --mount=type=secret,id=web_env,target=/app/apps/web/.env.local --mount=type=cache,target=/root/.bun/install/cache bun install

ENV NODE_ENV=production

# varlock valide le schéma pendant la compilation. Aucune de ces variables n'est lue
# par le code compilé : le serveur les relit dans son environnement au démarrage
# (`Config.String`), et le client n'en voit aucune. Ces valeurs de remplacement
# permettent donc de construire l'image sans connaître la configuration de l'hôte ;
# elles restent dans l'étage de compilation, que l'image finale ne conserve pas.
ENV BETTER_AUTH_SECRET=compilation-uniquement-remplace-au-demarrage
ENV BETTER_AUTH_URL=http://localhost:3001
ENV DATABASE_URL=postgresql://compilation@localhost:5432/compilation
ENV S3_ACCESS_KEY_ID=compilation
ENV S3_SECRET_ACCESS_KEY=compilation

RUN --mount=type=secret,id=web_env,target=/app/apps/web/.env.local cd apps/web && bun run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app

ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

# SSR chunks require workspace dependencies at runtime
WORKDIR /app/apps/web
CMD ["node", ".output/server/index.mjs"]
