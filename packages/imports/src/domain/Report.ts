import { ProjectId, SongId } from "@projection/shared-kernel";
import { Schema } from "effect";

/** Rapport d'import d'un agenda : chants créés, chants déjà connus, chants refusés. */
export class AgendaImportReport extends Schema.Class<AgendaImportReport>("AgendaImportReport")({
  projectId: ProjectId,
  projectName: Schema.String,
  imported: Schema.Array(Schema.Struct({ id: SongId, title: Schema.String })),
  reused: Schema.Array(Schema.Struct({ id: SongId, title: Schema.String })),
  errors: Schema.Array(Schema.Struct({ title: Schema.String })),
}) {}
