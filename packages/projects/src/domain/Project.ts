import {
  OrganizationId,
  ProjectId,
  ProjectItemId,
  SongId,
  TextSlideId,
} from "@projection/shared-kernel";
import { Schema } from "effect";

/** Éléments d'un projet : uniquement des références vers la bibliothèque (pas de copie). */
export class SongItem extends Schema.TaggedClass<SongItem>()("Song", {
  id: ProjectItemId,
  songId: SongId,
}) {}

export class ScriptureItem extends Schema.TaggedClass<ScriptureItem>()("Scripture", {
  id: ProjectItemId,
  translationId: Schema.NonEmptyString,
  /** Référence canonique (« Jean 3.16-18 »), résolue par le contexte bible. */
  reference: Schema.NonEmptyString,
}) {}

export class TextSlideItem extends Schema.TaggedClass<TextSlideItem>()("TextSlide", {
  id: ProjectItemId,
  textSlideId: TextSlideId,
}) {}

export class BlankItem extends Schema.TaggedClass<BlankItem>()("Blank", {
  id: ProjectItemId,
}) {}

export const ProjectItem = Schema.Union([SongItem, ScriptureItem, TextSlideItem, BlankItem]);
export type ProjectItem = typeof ProjectItem.Type;

/** Élément à ajouter : l'identifiant est attribué par le serveur. */
export const ProjectItemDraft = Schema.Union([
  Schema.TaggedStruct("Song", { songId: SongId }),
  Schema.TaggedStruct("Scripture", {
    translationId: Schema.NonEmptyString,
    reference: Schema.NonEmptyString,
  }),
  Schema.TaggedStruct("TextSlide", { textSlideId: TextSlideId }),
  Schema.TaggedStruct("Blank", {}),
]);
export type ProjectItemDraft = typeof ProjectItemDraft.Type;

/** Date calendaire `AAAA-MM-JJ`, sans fuseau. */
export const ProjectDate = Schema.NullOr(
  Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
);

export class Project extends Schema.Class<Project>("Project")({
  id: ProjectId,
  organizationId: OrganizationId,
  name: Schema.NonEmptyString,
  date: ProjectDate,
  items: Schema.Array(ProjectItem),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

export class ProjectInput extends Schema.Class<ProjectInput>("ProjectInput")({
  name: Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty()),
  date: ProjectDate,
}) {}

export class ProjectSummary extends Schema.Class<ProjectSummary>("ProjectSummary")({
  id: ProjectId,
  name: Schema.String,
  date: ProjectDate,
  itemCount: Schema.Int,
  updatedAt: Schema.Number,
}) {}

export class ProjectNotFound extends Schema.TaggedError<ProjectNotFound>()("ProjectNotFound", {
  id: ProjectId,
}) {}

export class ProjectItemNotFound extends Schema.TaggedError<ProjectItemNotFound>()(
  "ProjectItemNotFound",
  { itemId: ProjectItemId },
) {}
