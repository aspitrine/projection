import { SongId } from "@projection/shared-kernel";
import { Schema } from "effect";

export class InvalidLyrics extends Schema.TaggedError<InvalidLyrics>()("InvalidLyrics", {
  reason: Schema.Literals(["Empty", "DuplicateSection", "UndefinedRepeat"]),
  /** Balise concernée, telle que saisie (ex. « Refrain »). */
  tag: Schema.NullOr(Schema.String),
}) {}

export class SongNotFound extends Schema.TaggedError<SongNotFound>()("SongNotFound", {
  id: SongId,
}) {}
