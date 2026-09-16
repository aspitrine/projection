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

Au démarrage, le serveur prépare lui-même le stockage, sans commande manuelle :

1. **Garage** (si `GARAGE_ADMIN_URL` et `GARAGE_ADMIN_TOKEN` sont renseignés) : disposition du
   cluster, import de la clé `S3_ACCESS_KEY_ID`, création du bucket et droits de la clé dessus.
   Garage est attendu jusqu'à une minute s'il démarre après le serveur ; un jeton refusé échoue
   aussitôt.
2. **Bucket et règles CORS** (tout S3) : création du bucket s'il manque, puis autorisation de
   l'origine `BETTER_AUTH_URL`.

Chaque étape vérifie l'état avant d'agir : redémarrer ne modifie rien. Si le stockage est
injoignable, le serveur démarre quand même et consigne un avertissement — seule la médiathèque
est alors indisponible.

| Variable             | Rôle                                                            |
| -------------------- | --------------------------------------------------------------- |
| `GARAGE_ADMIN_URL`   | API d'administration, réseau interne (ex. `http://garage:3903`) |
| `GARAGE_ADMIN_TOKEN` | Jeton d'administration de Garage                                |
| `GARAGE_CAPACITY_GB` | Capacité annoncée pour le nœud (20 par défaut)                  |

Contraintes propres à Garage :

- le secret RPC (`GARAGE_RPC_SECRET`) doit faire **32 octets en hexadécimal**
  (`openssl rand -hex 32`) — un mot de passe alphanumérique est refusé au démarrage ;
- l'identifiant de clé commence par `GK` suivi de 24 caractères hexadécimaux, le secret en fait 64 ;
- l'API S3 doit être joignable **depuis le navigateur** (domaine public en HTTPS), l'API
  d'administration surtout pas.
