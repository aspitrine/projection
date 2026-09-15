# Tâches

Références : [PRD](docs/PRD.md) · [ADR 0001 — DDD + Effect](docs/adr/0001-architecture-ddd-effect.md) · [Format VideoPsalm](docs/formats/videopsalm.md)

Tranches verticales : chaque tâche livre un comportement testable de bout en bout (domaine → SQL → RPC → UI). Le contexte DDD concerné est indiqué entre crochets.

Légende : `[ ]` à faire · `[~]` en cours · `[x]` fait · **Dépend de** = tâches bloquantes.

---

## Phase 0 — Fondations

### T0.0 Cadrage ✅

- [x] PRD, ADR 0001, licence MIT, analyse du format VideoPsalm, fixture synthétique.

### T0.1 Socle Effect 4 [platform, shared-kernel]

- [x] Catalog Bun : `effect`, `@effect/sql-pg`, `@effect/atom-react`, `@effect/vitest` épinglés sur `4.0.0-rc.115`. `vitest@5` installé à part (vite-plus embarque vitest 4, incompatible avec `@effect/vitest`).
- [x] Retirer oRPC, Drizzle, Zod, TanStack Query (`packages/api`, `packages/db` supprimés).
- [x] `@projection/shared-kernel` : IDs brandés, `CurrentActor`.
- [x] `@projection/platform` : Layer `PgClient` depuis `Config`, runner de migrations par contexte (`Migrator.make` + table `<contexte>_migrations`), Layer de logs.
- [x] Composition root `apps/web/src/server/api.ts` : `HttpRouter.toWebHandler` monté sur `/api/rpc`, RPC `SystemHealth`, migrations better-auth au démarrage.
- [x] Client : `AtomRpc` + `@effect/atom-react`, statut API affiché sur la page d'accueil (rendu client uniquement ; hydratation SSR des atoms à traiter avec la première vraie page de données).
- [x] Tests : domaine pur (shared-kernel), handlers RPC avec Layer en mémoire (`RpcTest`), intégration Postgres (ignorée sans `DATABASE_URL`).
- [x] Gabarit de contexte : [docs/architecture/gabarit-contexte.md](docs/architecture/gabarit-contexte.md).
- [x] Port hôte Postgres configurable (`POSTGRES_PORT`).
- [x] `docker compose up --build` fonctionne (RPC `SystemHealth` → `database: up` depuis le conteneur).

### T0.2 Spike temps réel [live] ✅

**Dépend de** : T0.1

- [x] RPC `stream: true` (NDJSON sur HTTP) servi via TanStack Start / Nitro, reçu par deux onglets (`/spike/live`).
- [x] Mutation dans un onglet → événement reçu dans l'autre en < 200 ms (p50 1,6 ms, p95 2,7 ms en Docker).
- [x] Reconnexion automatique après coupure + resynchronisation de l'état complet (flux coupé à 360 s, conteneur recréé).
- [x] Vérifié en build Docker. Repli WebSocket inutile.
- **Livrable** : [docs/adr/0002-temps-reel.md](docs/adr/0002-temps-reel.md).

### T0.3 Identité et organisations [identity] ✅

**Dépend de** : T0.1

- [x] better-auth sur pool `pg` natif + plugin `organization` (rôles `owner`, `admin`, `operator` via access control) ; tables migrées au démarrage (`ensureAuthSchema`).
- [x] `packages/identity` (remplace `packages/auth`) : port `Authentication`, adapter better-auth, contrat `IdentityRpcs` (`IdentityWhoAmI`).
- [x] `ActorMiddleware` (RpcMiddleware) fournissant `CurrentActor` ; erreurs typées `Unauthenticated` / `NoActiveOrganization` ; `Forbidden` + `requireRole` dans le shared kernel.
- [x] Inscription → création d'organisation (`/onboarding`) ; nouvelle session → première organisation de l'utilisateur ; sélecteur d'organisation dans l'en-tête.
- [x] Page Membres : invitation par lien (pas encore d'envoi d'e-mail, lien affiché et journalisé), changement de rôle, retrait, annulation d'invitation ; page `/invitations/$id` (accepter / refuser).
- [x] Vérifié dans le navigateur : inscription → organisation → invitation → inscription de l'invité → rôle opérateur ; refus serveur (403) d'une invitation par un opérateur ; RPC sans session → `Unauthenticated`.
- [ ] Envoi réel des e-mails d'invitation (SMTP configurable) — à planifier.

### T0.4 i18n ✅

- [x] Paraglide JS : projet inlang `apps/web/project.inlang`, catalogue `messages/fr.json`, plugin Vite + `bun run i18n:compile` (appelé par `check-types`).
- [x] Tous les textes d'interface migrés vers `m.*()` (formulaires, messages de validation, menus, pages identity, `aria-label`).
- [x] Convention de clés : [docs/architecture/i18n.md](docs/architecture/i18n.md).

### T0.5 Layout applicatif ✅

**Dépend de** : T0.3

- [x] Layouts de routes : `_public` (accueil, connexion), `_auth/_setup` (onboarding, invitation, sans organisation), `_auth/_app` (organisation active requise).
- [x] Shell : barre latérale (Tableau de bord, Projets, Bibliothèque › Chants / Bible / Médias, Sorties, Paramètres › Membres), sélecteur d'organisation et menu utilisateur dans la barre du haut.
- [x] Responsive : tiroir de navigation sous 768 px (fermeture au clic, à la navigation et sur Échap).
- [x] Pages « Bientôt disponible » pour les sections non implémentées ; Membres déplacé sous `/settings/members`.

---

## Phase MVP

### T1.1 Chants — CRUD manuel [songs] ✅

**Dépend de** : T0.3

- [x] Domaine : `Song`, `SongSection` (type, numéro, libellé libre), ordre de passage ; parser/formateur de paroles (`[Couplet 1]`, `[Refrain]`, répétitions par balise vide, strophes sans balise, alias FR/EN).
- [x] Migration `songs` + `SqlSongRepository` (PgClient, filtré par organisation).
- [x] `SongsRpcs` (derrière `ActorMiddleware`) : list (recherche par titre), get, create, update, delete ; erreurs typées `InvalidLyrics`, `SongNotFound`.
- [x] UI : liste avec recherche, éditeur avec aperçu en direct (ordre de passage + diapos), création, modification, suppression.
- [x] Tests unitaires (parser, formateur, propriété aller-retour, cas d'usage avec repository en mémoire) et fonctionnels API sur Postgres (`TEST_DATABASE_URL`, isolation des organisations).

### T1.2 Moteur de découpage [presentation] ✅

- [x] Domaine pur : `ContentBlock`, `SplitRules` (max lignes, max caractères, regroupement de blocs, équilibrage), `split`.
- [x] Tests unitaires + propriétés (conservation des lignes, limites respectées, équilibrage).

### T1.3 Bible — Segond 1910 et références [bible]

**Dépend de** : T0.3

- [ ] Domaine : `Translation`, `Verse`, `VerseRange` ; parser de références FR (`Jean 3.16-18`, `jn 3:16`, `1 Co 13`) en pur + tests.
- [ ] Migrations + seed Segond 1910 (source et licence notées dans `docs/bibles.md`).
- [ ] `BibleRpc` : résoudre une référence.
- [ ] UI : saisie rapide avec aperçu du passage.

### T1.4 Diapo texte simple [slides]

**Dépend de** : T0.3

- [ ] Domaine, migrations, `SlidesRpc`, éditeur texte riche minimal.

### T1.5 Projets [projects]

**Dépend de** : T1.1, T1.3, T1.4

- [ ] Domaine : `Project`, `ProjectItem` (union taguée : chant + arrangement, passage, diapo texte, écran vide), réordonnancement.
- [ ] Migrations, `ProjectsRpc`.
- [ ] UI : créer un projet, ajouter des éléments, drag & drop.

### T1.6 Rendu de diapo [presentation, web]

**Dépend de** : T1.2

- [ ] Composant unique `SlideRenderer` (thème par défaut, auto-fit, 16:9), utilisé en miniature et en plein écran.

### T1.7 Sortie salle + page d'affichage [outputs]

**Dépend de** : T0.2, T1.6

- [ ] Domaine : `Output` (type, nom, token, thème), régénération de token.
- [ ] Sortie salle créée à la création d'une organisation.
- [ ] Route publique `/display/$token` plein écran, sans auth, abonnée au stream live.

### T1.8 Régie live [live]

**Dépend de** : T1.5, T1.7

- [ ] Domaine : `LiveSession` (projet actif, élément, index diapo, noir) + commandes (`GoTo`, `Next`, `Previous`, `Blackout`).
- [ ] Port `SlideSource` implémenté dans la composition root (songs, bible, slides → presentation).
- [ ] État en `SubscriptionRef`, persistance Postgres, `LiveRpc` (commandes + stream d'état).
- [ ] UI régie : éléments, grille des diapos, aperçu sortie ; raccourcis (flèches, espace, PageUp/PageDown, `B`).
- [ ] Deux régies synchronisées ; ajout d'un élément pendant le direct sans casser l'affichage.

**🎯 Jalon MVP** : un culte complet projeté depuis le navigateur, piloté par deux opérateurs.

---

## Phase v1

### T2.1 Trois types de sortie [outputs, presentation]

**Dépend de** : T1.8

- [ ] Types `salle`, `retour`, `stream`, règles de découpage par sortie.
- [ ] Sortie stream : fond transparent, lower third, testée dans OBS.

### T2.2 Pistes Salle / Stream [live]

**Dépend de** : T2.1

- [ ] Deux curseurs dans `LiveSession`, mode lié/délié ; en mode lié le stream suit la salle en sous-découpage.
- [ ] Panneau stream dans la régie.

### T2.3 Ajustement manuel du stream [live]

**Dépend de** : T2.2

- [ ] Sélection libre de lignes envoyée sur la piste stream.

### T2.4 Boutons d'urgence complets [live]

**Dépend de** : T2.2

- [ ] Noir, logo, masquer le texte (fond conservé), par piste.

### T2.5 Thèmes personnalisables [presentation, outputs]

**Dépend de** : T2.1, T2.8

- [ ] Éditeur de thème avec aperçu live ; bouton « Réinitialiser aux valeurs par défaut ».
- [ ] Transition fondu (durée configurable).

### T2.6 Sortie retour scène [outputs, live]

**Dépend de** : T2.1

- [ ] Diapo courante + suivante, horloge, minuteur piloté depuis la régie, notes par élément.

### T2.7 Édition des paroles en live [songs, live]

**Dépend de** : T1.8

- [ ] Édition d'une section depuis la régie → sauvegarde en bibliothèque → diffusion immédiate.
- [ ] Édition concurrente : dernière écriture + notification aux autres opérateurs.

### T2.8 Médias (Garage) [media, platform]

**Dépend de** : T0.3

- [ ] Service Garage dans `docker-compose.yml`, init bucket/clé documentée.
- [ ] Layer S3 dans `platform`, port `MediaStorage` dans `media`, upload pré-signé.
- [ ] Bibliothèque médias, élément de projet média, lecture vidéo pilotée depuis la régie.

### T2.9 Import VideoPsalm [songs, projects]

**Dépend de** : T1.1, T1.5

- [ ] Parser tolérant (clés non quotées, retours à la ligne bruts) + tests sur `culte-synthetique.vpagd`.
- [ ] Normalisation : retrait des accords, NFC, nettoyage, dédoublonnage des sections, ordre de passage.
- [ ] Import `.vpagd` → chants en bibliothèque (dédoublonnés par `Guid`) + projet créé dans l'ordre de l'agenda.
- [ ] Import de recueil (dès réception d'un échantillon).

### T2.10 Imports OpenLyrics et ChordPro [songs]

**Dépend de** : T1.1

- [ ] Parsers + tests ; UI d'import multi-fichiers avec rapport (importés / doublons / erreurs), partagée avec T2.9.

### T2.11 Recherche full-text [songs, bible]

**Dépend de** : T1.1, T1.3

- [ ] `tsvector` + `unaccent` (config `french`) sur paroles et versets ; recherche unifiée.

### T2.12 Traductions bibliques libres + import [bible]

**Dépend de** : T1.3

- [ ] Inventaire des traductions du domaine public dans `docs/bibles.md`, seeds associés.
- [ ] Import OSIS / USFM / Zefania par organisation ; traduction par défaut par organisation.

### T2.13 Diapos texte — mises en page [slides]

**Dépend de** : T1.4, T2.5

- [ ] Mises en page prédéfinies (titre, titre + corps, citation).

### T2.14 Régie responsive [web]

**Dépend de** : T2.2

- [ ] Vue tablette/mobile utilisable pour le pilotage.

---

## Tests E2E (en fin de projet)

- [ ] Playwright est configuré (`apps/web/playwright.config.ts`, build de prod sur le port 3101, base `TEST_DATABASE_URL`) avec des specs identity, navigation et chants : à finaliser et exécuter en fin de projet.
- [ ] Problème connu : sur le build de production, la réponse RPC de `SongsCreate` n'arrive pas au navigateur (le chant est pourtant enregistré) ; fonctionne en dev. À diagnostiquer.

## Phase v2

- [ ] T3.1 Modèles de culte réutilisables [projects].
- [ ] T3.2 Autres langues d'interface.
- [ ] T3.3 Multi-instance (`LISTEN/NOTIFY` Postgres) [live, platform].
- [ ] T3.4 Montée en Effect 4.0 final.

---

## En attente

- [ ] Échantillons VideoPsalm : recueil seul, agenda avec Bible / médias / texte.
