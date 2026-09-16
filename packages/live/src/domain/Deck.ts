import { FrameContent } from "@projection/presentation/domain";
import { ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { Schema } from "effect";

/** Diapo prête à diffuser, avec son libellé pour la régie. */
export class DeckSlide extends Schema.Class<DeckSlide>("DeckSlide")({
  content: FrameContent,
  /** Section, verset ou titre ; affiché en régie, masqué sur les écrans de salle. */
  label: Schema.NullOr(Schema.String),
  /** Section d'origine (chant), pour l'édition en direct. */
  sectionId: Schema.NullOr(Schema.String),
  /** Sous-découpage pour la piste Stream (au moins une partie). */
  parts: Schema.Array(FrameContent),
}) {}

export const DeckItemKind = Schema.Literals(["Song", "Scripture", "TextSlide", "Blank"]);
export type DeckItemKind = typeof DeckItemKind.Type;

export class DeckItem extends Schema.Class<DeckItem>("DeckItem")({
  itemId: ProjectItemId,
  kind: DeckItemKind,
  title: Schema.String,
  /** Contenu de bibliothèque d'origine (identifiant du chant ou de la diapo texte). */
  sourceId: Schema.NullOr(Schema.String),
  /** Notes de l'élément, affichées sur le retour scène. */
  notes: Schema.NullOr(Schema.String),
  /** Contenu supprimé de la bibliothèque ou introuvable : aucune diapo. */
  missing: Schema.Boolean,
  slides: Schema.Array(DeckSlide),
}) {}

/** Projet résolu en diapos, élément par élément. */
export class Deck extends Schema.Class<Deck>("Deck")({
  projectId: ProjectId,
  projectName: Schema.String,
  items: Schema.Array(DeckItem),
}) {}
