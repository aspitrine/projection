import { Schema } from "effect";

export const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const OrganizationId = Schema.NonEmptyString.pipe(Schema.brand("OrganizationId"));
export type OrganizationId = typeof OrganizationId.Type;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SongId = Schema.String.check(Schema.isPattern(uuidPattern)).pipe(
  Schema.brand("SongId"),
);
export type SongId = typeof SongId.Type;

export const TextSlideId = Schema.String.check(Schema.isPattern(uuidPattern)).pipe(
  Schema.brand("TextSlideId"),
);
export type TextSlideId = typeof TextSlideId.Type;

export const ProjectId = Schema.String.check(Schema.isPattern(uuidPattern)).pipe(
  Schema.brand("ProjectId"),
);
export type ProjectId = typeof ProjectId.Type;

export const ProjectItemId = Schema.String.check(Schema.isPattern(uuidPattern)).pipe(
  Schema.brand("ProjectItemId"),
);
export type ProjectItemId = typeof ProjectItemId.Type;
