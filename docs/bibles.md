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

## Importer

Le fichier source n'est pas versionné. Télécharger et décompresser l'archive USFM, puis :

```bash
bun run bible:import -- /chemin/vers/fraLSG_usfm          # base de développement
bun run bible:import -- /chemin/vers/fraLSG_usfm --test   # base de test
```

L'import est idempotent : il crée ou met à jour la traduction et remplace tous ses versets, en transaction.

## À évaluer (T2.12)

Darby 1885, Martin 1744, Ostervald 1877, Crampon 1923, Lausanne 1872 : vérifier pour chacune la source numérique et sa licence (le texte d'origine peut être libre alors qu'une édition numérique ne l'est pas).
