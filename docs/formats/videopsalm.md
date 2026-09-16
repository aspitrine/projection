# Format VideoPsalm

Analyse faite à partir de deux fichiers réels : `Culte.vpagd` (agenda de 10 chants) et un second
agenda de 14 chants (`Version.json` = `2` dans les deux cas). Les points marqués **(hypothèse)**
doivent être confirmés avec d'autres fichiers.

## Conteneur `.vpagd` (agenda / culte)

Archive **ZIP** (entrées non compressées, méthode _Stored_). Contenu :

| Entrée                                                                                                                  | Rôle                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Version.json`                                                                                                          | Version du format (`2`)                                                                                                                 |
| `*Style.json` (`Audio`, `Bible`, `Excel`, `Image`, `Pdf`, `PowerPoint`, `Root`, `SongBook`, `Video`, `WebSite`, `Word`) | Styles par type d'élément. Souvent `{}`. Ex. `VideoStyle.json` : `{Background:{Stretch:2,IsLooping:0}}`                                 |
| `SongBook_N.json`                                                                                                       | Recueil d'origine de l'élément _N_ : `Abbreviation`, `VersionDate` (`yyyyMMddHHmmss`), `Guid`, `Text` (nom), `Description`, `Songs: []` |
| `Song_N.json`                                                                                                           | Chant de l'élément _N_ (voir ci-dessous)                                                                                                |
| `AgendaItemProperties.json`                                                                                             | `Items[]` dans l'ordre de l'agenda : `FlowType`, `AutoAdvance` (0/1), `Interval` (ms), `VerseOrderIndex` (`-1` = ordre par défaut)      |

L'ordre des éléments de l'agenda est l'index _N_.

Seuls des chants sont présents dans l'échantillon. Les autres types d'éléments (Bible, image, vidéo…) produisent probablement d'autres préfixes d'entrée **(hypothèse, échantillon nécessaire)**.

## Syntaxe des fichiers `.json`

**Ce n'est pas du JSON valide, ni du JSON5** :

- clés non quotées : `{Guid:"…",Text:"…"}` ;
- chaînes entre guillemets doubles contenant des **retours à la ligne bruts** (LF) ;
- encodage UTF-8 sans BOM ;
- nombres non quotés (`Tag:1`).

→ Parser dédié (tokenizer tolérant), pas de `JSON.parse` direct.

## Chant (`Song_N.json`)

| Champ       | Exemple                                 | Mapping                                              |
| ----------- | --------------------------------------- | ---------------------------------------------------- |
| `Guid`      | `"6f34eb36d9308b62d84c31"`              | identifiant externe (dédoublonnage à l'import)       |
| `Text`      | `"Car ta bonté"`                        | titre                                                |
| `Author`    | `"Paul Wilbur"`, `" Inconnu - Inconnu"` | auteurs (trim ; `Inconnu` → vide)                    |
| `Composer`  | `"NV Junior"`                           | auteurs, quand `Author` est absent                   |
| `Copyright` | `"© 2006 …"`                            | copyright                                            |
| `Key`       | `"Em"`                                  | tonalité                                             |
| `Reference` | `"JEM669"`, `"!JEM910"`                 | référence recueil (préfixe `!` à conserver tel quel) |
| `Memo1`     | texte multi-ligne                       | notes                                                |
| `Verses[]`  | `{Tag?, Text}`                          | sections, **dans l'ordre de passage**                |

### `Tag` des sections

| Tag    | Signification                                  | Indice                                            |
| ------ | ---------------------------------------------- | ------------------------------------------------- |
| absent | couplet                                        | numérotés dans l'ordre d'apparition               |
| `1`    | refrain                                        | observé répété plusieurs fois                     |
| `2`    | pré-refrain **(hypothèse)**                    | avant un refrain (« Majesté »)                    |
| `3`    | pont **(hypothèse)**                           | section distincte en fin de chant                 |
| `5`    | intro instrumentale **(hypothèse)**            | accords seuls, en tête de chant (2e agenda)       |
| `6`    | tag / phrase finale **(hypothèse)**            | courte phrase répétée en fin de chant (2e agenda) |
| `8`    | intro / interlude instrumental **(hypothèse)** | accords seuls                                     |
| `9`    | fin **(hypothèse)**                            | accords seuls, dernière section                   |

Un même tag peut couvrir **plusieurs textes différents** dans un chant (deux ponts, deux refrains).
À l'import, les homonymes sont numérotés (« Refrain 2 », « Pont 2 »), sinon la bibliothèque
refuserait deux sections de même nom au contenu différent.

### Texte des sections

- Accords **inline** au format `[Cm]`, `[D/F#]`, `[Em/C#]`, y compris en milieu de mot (`bon[B7]té`) ou collés (`[Fm][C]`).
- ⚠️ **Caractères décomposés coupés par un accord** : `a[E]̀ Toi` (lettre + accord + diacritique combinant U+0300). Après suppression des accords → normaliser en **NFC** pour obtenir `à`.
- Sections composées uniquement d'accords (tags 8, 9) → aucune ligne projetable.
- Artefacts à nettoyer : espaces multiples, espaces en début de ligne, lignes réduites à `.`.

### Répétitions

Les sections répétées (ex. refrain) sont **dupliquées** dans `Verses`. À l'import :

1. normaliser chaque section (accords retirés, NFC, trim) ;
2. dédoublonner par `(tag, texte normalisé)` → sections du chant ;
3. conserver la séquence d'origine → ordre de passage par défaut.

Le texte brut avec accords est conservé en source (future fonction grille d'accords).

## Fixtures

- `packages/songs/test/fixtures/videopsalm/culte-synthetique.vpagd` : fichier **synthétique** (paroles originales, libres) reproduisant toutes les particularités ci-dessus. Versionné.
- `packages/songs/test/fixtures/videopsalm/local/` : fichiers réels (paroles sous droits). **Non versionné** (`.gitignore`).

## Observations du second agenda

- Deux éléments peuvent porter **le même `Guid`** : même chant dans deux tonalités (`Key` différente).
  À l'import, le chant n'est créé qu'une fois et le projet le reprend deux fois, dans l'ordre.
  La tonalité n'est pas encore conservée.
- Une clé littérale `null` apparaît (`null:"Holy Forever"`, titre d'origine) : le lecteur tolérant
  l'accepte comme une clé ordinaire.
- Les chaînes contiennent des guillemets échappés (`\"Tu es saint\"`).
- L'agenda ne contenait, là encore, **que des chants** : aucun élément Bible, texte ou image.

## Échantillons encore nécessaires

- Recueil VideoPsalm seul (extension de recueil) : structure, `VerseOrders` éventuels.
- Agenda contenant des éléments Bible, image, vidéo, texte.
- Chant avec `VerseOrderIndex` ≠ `-1`.
