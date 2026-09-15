import { SongId } from "@projection/shared-kernel";
import { Schema } from "effect";

/** Formats d'import de chants (OpenLyrics et VideoPsalm à venir, T2.9 / T2.10). */
export const ImportFormat = Schema.Literals(["chordpro"]);
export type ImportFormat = typeof ImportFormat.Type;

export const ImportFile = Schema.Struct({
  fileName: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
  /** Contenu texte (UTF-8), 200 Ko au plus. */
  content: Schema.String.check(Schema.isMaxLength(200_000)),
});
export type ImportFile = typeof ImportFile.Type;

/** 50 fichiers au plus par import. */
export const ImportFiles = Schema.Array(ImportFile).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(50),
);

export const ImportErrorReason = Schema.Literals([
  "NoLyrics",
  "Empty",
  "DuplicateSection",
  "UndefinedRepeat",
]);

/** Rapport d'import : chants créés, doublons ignorés (même titre), fichiers en erreur. */
export class ImportReport extends Schema.Class<ImportReport>("ImportReport")({
  imported: Schema.Array(
    Schema.Struct({ fileName: Schema.String, id: SongId, title: Schema.String }),
  ),
  duplicates: Schema.Array(Schema.Struct({ fileName: Schema.String, title: Schema.String })),
  errors: Schema.Array(Schema.Struct({ fileName: Schema.String, reason: ImportErrorReason })),
}) {}
