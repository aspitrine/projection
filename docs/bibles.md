# Traductions bibliques

Seules les traductions **du domaine public** sont distribuées avec Projection. Une instance peut importer d'autres traductions dont elle détient les droits (T2.12).

## Importées

| Id        | Traduction        | Source                                                                                                 | Licence                                                                                          | Vérifié le |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------- |
| `lsg1910` | Louis Segond 1910 | [eBible.org — fraLSG](https://ebible.org/find/details.php?id=fraLSG), fichier `fraLSG_usfm.zip` (USFM) | Domaine public (« Cette Bible est dans le domaine public. Il n'est pas protégé par copyright. ») | 2026-09-15 |

Notes sur l'édition eBible :

- 66 livres (canon protestant), 31 170 versets ; les livres hors canon éventuels sont ignorés à l'import.
- Versification française : les suscriptions des Psaumes sont le verset 1.
- Le fichier contient des introductions de livres, titres de sections et références croisées : ils ne sont **pas** importés (seul le texte des versets l'est).

## Importer depuis l'application

Page **Bible**, réservé aux propriétaires et administrateurs : renseignez code, nom, langue et
licence, puis choisissez un fichier **USFM**, **OSIS** ou **Zefania** (30 Mo au plus). La
traduction appartient alors à l'organisation : elle n'est visible que par elle. Réimporter le même
code remplace tous ses versets.

Les livres hors canon protestant sont ignorés, comme à l'import par script. Le format est reconnu
automatiquement ; un fichier d'un autre type est refusé avec un message clair.

La **traduction par défaut** de l'organisation se choisit au même endroit : elle est présélectionnée
sur la page Bible et dans la recherche.

## Importer par script (traductions livrées)

Le fichier source n'est pas versionné. Télécharger et décompresser l'archive USFM, puis :

```bash
bun run bible:import -- /chemin/vers/fraLSG_usfm          # base de développement
bun run bible:import -- /chemin/vers/fraLSG_usfm --test   # base de test
```

L'import est idempotent : il crée ou met à jour la traduction et remplace tous ses versets, en transaction.

## À évaluer

Ces traductions sont libres de droits en France, mais chaque **édition numérique** doit être
vérifiée avant d'être distribuée avec l'application :

| Traduction     | Piste de source                    | À vérifier                              |
| -------------- | ---------------------------------- | --------------------------------------- |
| Darby 1885     | eBible.org (`fraDBY`), Zefania XML | licence de l'édition numérique          |
| Martin 1744    | Zefania XML, theWord               | qualité du texte, versification         |
| Ostervald 1877 | eBible.org (`fraOST`), Zefania XML | édition retenue (1877 ou révision 1996) |
| Crampon 1923   | Zefania XML                        | licence de l'édition, notes à écarter   |
| Lausanne 1872  | archive.org (numérisation)         | disponibilité d'un texte structuré      |

En attendant, une organisation peut importer elle-même l'une de ces traductions depuis la page
Bible, sous sa propre responsabilité.
