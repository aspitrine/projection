# PRD — Projection

Logiciel de vidéo-projection pour églises et événements (type VideoPsalm), 100 % web, auto-hébergeable.

## 1. Problème

Les logiciels de projection existants sont des applications desktop (Windows surtout), liées à une machine, difficiles à partager entre plusieurs opérateurs et mal adaptés au streaming (sortie texte en bas d'écran, fond transparent). On veut une application en ligne où l'on prépare un culte depuis n'importe où, et où plusieurs opérateurs pilotent en direct la projection en salle et l'habillage du stream.

## 2. Utilisateurs

- **Administrateur d'organisation** : gère les membres, les sorties, les thèmes, la bibliothèque.
- **Opérateur** : prépare les projets et pilote le direct. Plusieurs opérateurs peuvent agir en même temps, sur tout (ex. un pour la salle, un pour le stream).
- **Écran d'affichage** : navigateur plein écran (projecteur, écran retour, source navigateur OBS) ouvert via une URL publique à token, sans connexion.

## 3. Contraintes

- Application **en ligne uniquement** (pas de mode hors ligne).
- **Auto-hébergeable** via Docker Compose : app web, Postgres, stockage S3-compatible (Garage).
- Stack : TanStack Start, **Effect 4** (RPC, SQL, Schema, Atom), Postgres, better-auth, Bun, Vite+. Code organisé en bounded contexts DDD — voir [ADR 0001](adr/0001-architecture-ddd-effect.md).
- Licence **MIT**.
- Interface **i18n-ready**, français uniquement pour l'instant.

## 4. Glossaire

| Terme | Définition |
|---|---|
| Organisation | Tenant (une église). Possède membres, bibliothèque, sorties, thèmes, projets. |
| Bibliothèque | Contenus réutilisables : chants, bibles, médias, diapos texte. |
| Chant | Titre, auteurs, copyright, sections (couplet, refrain, pont…) et un ou plusieurs ordres de passage. |
| Ordre de passage | Suite ordonnée de références de sections (C1, R, C2, R, R) sans dupliquer le texte. |
| Projet | Un culte/événement : liste ordonnée d'éléments. |
| Élément | Référence vers un contenu de bibliothèque (chant + ordre, passage biblique, diapo texte, média, écran vide). |
| Sortie | Écran de destination avec type, thème et token d'accès. Persistante au niveau de l'organisation (l'URL OBS ne change pas d'un culte à l'autre). |
| Type de sortie | `salle` (projecteur), `retour` (écran retour scène), `stream` (lower third, fond transparent). |
| Découpage | Façon de couper un contenu en diapos pour une sortie (ex. salle = strophe entière, stream = 2 lignes). |
| Piste | Curseur de navigation en direct. Piste **Salle** (sorties salle + retour) et piste **Stream**, liables ou indépendantes. |
| Session live | État temps réel d'une organisation : projet actif, élément et diapo courants par piste, états d'urgence. |

## 5. Fonctionnalités

### 5.1 Organisations et comptes
- Multi-organisation, plusieurs utilisateurs par organisation (plugin `organization` de better-auth).
- Rôles : `owner`, `admin`, `operator`. Invitation par e-mail/lien.
- Changement d'organisation active.

### 5.2 Bibliothèque — Chants
- CRUD chant : titre, auteurs, copyright, CCLI, mots-clés, sections typées avec label.
- Plusieurs ordres de passage par chant, un par défaut.
- Import : **OpenLyrics** (XML), **ChordPro**, **VideoPsalm** (agenda `.vpagd` et recueils — voir [format](formats/videopsalm.md)). Accords conservés dans la source brute (future grille d'accords), retirés à l'affichage.
- Recherche par titre et par contenu des paroles (full-text Postgres, `unaccent`).
- **Édition en live** : correction des paroles pendant la projection, sauvegardée dans la bibliothèque et diffusée immédiatement aux sorties.

### 5.3 Bibliothèque — Bible
- Traductions libres de droits importées en base (seed) : Louis Segond 1910, Darby 1885, Martin 1744, Ostervald 1877, Crampon 1923, Lausanne 1872… (licence à vérifier traduction par traduction avant import).
- Import de fichiers supplémentaires (OSIS / USFM / Zefania) pour les traductions dont l'organisation détient les droits.
- Saisie rapide par référence : `Jean 3.16-18`, `jn 3:16`, `1 Co 13`, abréviations françaises.
- Recherche par contenu (full-text).
- Affichage d'un passage multi-versets, découpé automatiquement par sortie.

### 5.4 Bibliothèque — Médias
- Upload images et vidéos vers stockage S3-compatible (Garage), URLs pré-signées.
- Utilisation comme élément de projet ou comme fond de thème.

### 5.5 Diapos texte
- Éditeur de texte riche simple (gras, italique, listes, titres) + mises en page prédéfinies (titre seul, titre + corps, citation…).
- Pas d'éditeur à positionnement libre.

### 5.6 Projets
- CRUD projet (nom, date), liste ordonnée d'éléments (drag & drop).
- Les éléments référencent la bibliothèque (pas de copie).
- Ajout / modification pendant le direct sans interrompre la projection.
- (v2) Modèles de culte réutilisables.

### 5.7 Sorties et thèmes
- Trois types de sortie, chacune avec son propre thème et découpage.
- URL publique `/{locale}/display/{token}`, token régénérable.
- Thème : police, taille (auto-fit pour que le texte tienne), couleur, contour/ombre, alignement, position, marges, fond (couleur, image, vidéo, transparent), référence/copyright affichés ou non.
- Thèmes par défaut par type de sortie, personnalisables, **réinitialisables aux valeurs par défaut**.
- Sortie stream : fond transparent, texte en bas (lower third), compatible source navigateur OBS.
- Sortie retour : diapo courante, diapo suivante, horloge, minuteur, notes.
- Transition : fondu.

### 5.8 Régie (contrôle live)
- Vue projet : liste des éléments, aperçu des diapos, aperçu de chaque sortie.
- Navigation : clic sur une diapo, raccourcis clavier (flèches, espace, PageUp/PageDown — compatible télécommandes de présentation).
- Pistes **Salle** et **Stream** : liées par défaut (le stream suit la salle en sous-découpage), déliables pour qu'un opérateur stream navigue indépendamment.
- Ajustement manuel du stream : sélection libre de lignes à afficher.
- Boutons d'urgence par piste : **écran noir**, **logo**, **masquer le texte** (fond conservé).
- Multi-opérateurs : toutes les régies ouvertes voient le même état en temps réel.
- Responsive (desktop prioritaire, utilisable sur tablette/mobile).

## 6. Architecture technique

- **Organisation** : un package par bounded context (`identity`, `songs`, `bible`, `media`, `slides`, `presentation`, `projects`, `outputs`, `live`), couches `domain` / `application` / `infrastructure` / `api`. Détails : [ADR 0001](adr/0001-architecture-ddd-effect.md).
- **Temps réel** : état de session live autoritaire côté serveur (`SubscriptionRef` + `PubSub` Effect), persisté en Postgres. Mutations via Effect RPC ; diffusion aux régies et sorties via RPC en streaming. Mono-instance au départ ; `LISTEN/NOTIFY` Postgres si multi-instance plus tard. À valider par un spike (T0.2).
- **Découpage** : fonction pure `(contenu, règles de découpage) → diapos`, partagée client/serveur, testée unitairement.
- **Rendu** : un seul composant de rendu de diapo utilisé par les sorties et les aperçus de régie (même rendu partout).
- **Stockage** : Garage ajouté au `docker-compose.yml`, client S3 dans un package dédié.
- **Recherche** : `tsvector` + `unaccent` configuration `french`.
- **i18n** : bibliothèque de traduction (ex. Paraglide JS) branchée dès le départ, catalogue `fr` seul.

## 7. Périmètre par phase

### MVP
Organisations, chants (saisie manuelle + ordre de passage), Bible (Segond 1910 + saisie par référence), diapo texte simple, projets, **une sortie salle** avec thème par défaut, régie temps réel multi-opérateurs, raccourcis clavier, écran noir.

### v1
Trois types de sortie + pistes Salle/Stream + ajustement manuel, thèmes personnalisables avec reset, imports (OpenLyrics, ChordPro, VideoPsalm), autres traductions libres + import de fichiers, recherche full-text, médias Garage, logo / masquer texte, fondu, édition de paroles en live, sortie retour (suivante, horloge, minuteur, notes), mises en page de diapos texte.

### v2
Modèles de culte, autres langues d'interface, multi-instance.

## 8. Hors périmètre

Mode hors ligne, éditeur de diapos à positionnement libre, application desktop/native, gestion des licences CCLI automatisée.

## 9. Décisions

### Prises
- **Licence MIT** pour le code. Seules les traductions bibliques du domaine public sont distribuées ; les autres sont importées par chaque instance sous sa responsabilité.
- **Pistes Salle/Stream** adoptées telles que décrites, sans maquette préalable.
- **Architecture DDD par feature + Effect 4** : [ADR 0001](adr/0001-architecture-ddd-effect.md).
- **Aucun contenu sous droits dans le repo** (fixtures réelles non versionnées).

### Ouvertes
- Échantillons VideoPsalm supplémentaires (recueil seul, agenda avec Bible/médias) — voir [format](formats/videopsalm.md).
