# Déploiement auto-hébergé

Projection s'héberge derrière un reverse proxy (nginx, Traefik, Caddy) qui termine TLS et
transmet à l'application (`docker-compose.yml`, port 3001 par défaut).

## Le point qui casse tout : le tampon du proxy

La régie et les écrans **restent abonnés** à `/api/rpc` : la réponse HTTP ne se termine pas,
et le serveur y écrit une ligne NDJSON à chaque changement d'image, plus un battement de cœur
toutes les 10 secondes (voir [ADR 0002](adr/0002-temps-reel.md)).

Un proxy qui met les réponses en tampon retient ces lignes jusqu'à remplir son tampon : les
écrans changent alors de diapo avec plusieurs secondes de retard, ou pas du tout, alors que
tout paraît normal côté serveur.

L'application envoie déjà les en-têtes qui désactivent ce tampon
(`X-Accel-Buffering: no`, `Cache-Control: no-cache, no-store, no-transform`). nginx les
respecte. Ajouter tout de même la configuration explicite, car un `proxy_buffering on` posé
dans le bloc `location` l'emporte sur l'en-tête.

### nginx

```nginx
location /api/rpc {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;

    # Flux temps réel : ni tampon, ni délai de lecture, ni compression.
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
    gzip off;

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Traefik

Traefik ne met pas les réponses en tampon par défaut : ne pas activer le middleware
`buffering` (son `responseBody` couperait les flux). Allonger le délai de lecture :

```yaml
entryPoints:
  websecure:
    address: ":443"
    transport:
      respondingTimeouts:
        readTimeout: 0 # pas de limite sur les requêtes entrantes
        idleTimeout: 1h
```

### Caddy

Rien à faire : `reverse_proxy` diffuse au fil de l'eau et n'a pas de tampon de réponse.

### Cloudflare et CDN

Le mode proxy (nuage orange) tolère les réponses longues, mais applique ses propres délais et
peut recompresser. Si les écrans se figent, mettre `/api/rpc` en **DNS only**, ou créer une
règle de contournement du cache et de la compression pour ce chemin.

## Vérifier depuis le serveur

Un abonnement sain écrit une ligne tout de suite (état complet), puis une toutes les
10 secondes même sans rien toucher :

```bash
curl -N -sS -X POST https://projection.exemple.org/api/rpc -D - -o /dev/null
```

Dans les en-têtes renvoyés, vérifier `x-accel-buffering: no`. Si la commande ne rend la main
qu'à la fin, ou si les lignes arrivent par salves, le tampon est encore actif quelque part.

## Reste à surveiller

- **Plusieurs instances** : l'image de chaque piste et la session de régie vivent en base, et
  les instances se réveillent par `LISTEN/NOTIFY` (canaux `projection_frames` et
  `projection_live_session`). Répliquer l'application est donc possible, à deux conditions :
  toutes les instances pointent sur la **même base**, et le pool laisse une connexion libre par
  instance pour l'écoute (`LISTEN` en retient une). Aucune affinité de session n'est requise.
- **Stockage des médias** : Garage (ou tout S3) doit être joignable **depuis le navigateur**,
  pas seulement depuis le serveur — les téléversements et les lectures passent par des URL
  signées. Voir [docs/medias.md](medias.md).
