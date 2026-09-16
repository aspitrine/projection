import { MediaId, OrganizationId } from "@projection/shared-kernel";
import { Schema } from "effect";

export const MediaKind = Schema.Literals(["image", "video"]);
export type MediaKind = typeof MediaKind.Type;

/** Types acceptés et extension de rangement associée. */
const acceptedTypes: Record<string, { readonly kind: MediaKind; readonly extension: string }> = {
  "image/jpeg": { kind: "image", extension: ".jpg" },
  "image/png": { kind: "image", extension: ".png" },
  "image/webp": { kind: "image", extension: ".webp" },
  "image/avif": { kind: "image", extension: ".avif" },
  "image/gif": { kind: "image", extension: ".gif" },
  "video/mp4": { kind: "video", extension: ".mp4" },
  "video/webm": { kind: "video", extension: ".webm" },
  "video/quicktime": { kind: "video", extension: ".mov" },
};

export const acceptedContentTypes = Object.keys(acceptedTypes);

/** Tailles maximales par type (le stockage reste maître de ses propres limites). */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export const maxBytesFor = (kind: MediaKind) =>
  kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;

export const mediaKindOf = (contentType: string) => acceptedTypes[contentType]?.kind ?? null;

/** Clé de rangement : préfixée par l'organisation, donc isolée par locataire. */
export const storageKeyFor = (organizationId: string, id: string, contentType: string) =>
  `${organizationId}/${id}${acceptedTypes[contentType]?.extension ?? ""}`;

export class MediaAsset extends Schema.Class<MediaAsset>("MediaAsset")({
  id: MediaId,
  organizationId: OrganizationId,
  kind: MediaKind,
  name: Schema.NonEmptyString,
  contentType: Schema.String,
  sizeBytes: Schema.Int,
  storageKey: Schema.String,
  /** Faux tant que le navigateur n'a pas confirmé la fin du téléversement. */
  ready: Schema.Boolean,
  createdAt: Schema.Number,
}) {}

export class MediaUploadInput extends Schema.Class<MediaUploadInput>("MediaUploadInput")({
  name: Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty(), Schema.isMaxLength(255)),
  contentType: Schema.String,
  sizeBytes: Schema.Int.check(Schema.isGreaterThan(0)),
}) {}

/** Ce qu'il faut au navigateur pour téléverser directement vers le stockage. */
export class MediaUpload extends Schema.Class<MediaUpload>("MediaUpload")({
  asset: MediaAsset,
  uploadUrl: Schema.String,
}) {}

export class MediaNotFound extends Schema.TaggedError<MediaNotFound>()("MediaNotFound", {
  id: MediaId,
}) {}

export class UnsupportedMedia extends Schema.TaggedError<UnsupportedMedia>()("UnsupportedMedia", {
  contentType: Schema.String,
}) {}

export class MediaTooLarge extends Schema.TaggedError<MediaTooLarge>()("MediaTooLarge", {
  sizeBytes: Schema.Int,
  maxBytes: Schema.Int,
}) {}

/** Les écrans gardent une URL valable toute la durée d'un culte. */
export const MEDIA_DISPLAY_TTL_SECONDS = 6 * 3600;
