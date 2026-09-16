# Médias (stockage S3 compatible)

Les images et vidéos sont stockées dans un service S3 compatible — [Garage](https://garagehq.deuxfleurs.fr)
en développement comme en auto-hébergement. L'application ne sert jamais les fichiers elle-même :
le navigateur téléverse et lit directement le stockage via des URL pré-signées à durée de vie courte.

## Démarrage en développement

```bash
bun run storage:start   # lance le conteneur Garage
bun run storage:init    # disposition du cluster, bucket, clé ; affiche les variables d'environnement
bun run storage:cors    # autorise le navigateur (origine locale) à téléverser
```

Copiez les variables affichées dans `apps/web/.env` (jamais versionné) :

| Variable               | Rôle                                                 |
| ---------------------- | ---------------------------------------------------- |
| `S3_ENDPOINT`          | URL de l'API S3 (ex. `http://localhost:3900`)        |
| `S3_REGION`            | Région déclarée par le serveur (`garage`)            |
| `S3_BUCKET`            | Bucket des médias                                    |
| `S3_ACCESS_KEY_ID`     | Identifiant de la clé (visible dans les URL signées) |
| `S3_SECRET_ACCESS_KEY` | Secret de la clé                                     |

## Règles

- Types acceptés : JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, QuickTime.
- Taille maximale : 20 Mo pour une image, 500 Mo pour une vidéo.
- Chaque fichier est rangé sous `<organisation>/<identifiant>`, ce qui isole les organisations.
- Les URL pré-signées expirent au bout de 15 minutes (lecture) et 10 minutes (téléversement).
- Supprimer un média retire la ligne en base **et** l'objet du stockage.

## Production

Utilisez un bucket dédié, une clé n'ayant accès qu'à ce bucket, et un secret RPC Garage propre à
l'installation (`openssl rand -hex 32`, jamais versionné). Les règles CORS doivent lister l'origine
publique de l'application.
