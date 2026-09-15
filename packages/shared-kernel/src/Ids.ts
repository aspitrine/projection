import { Schema } from "effect";

export const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const OrganizationId = Schema.NonEmptyString.pipe(Schema.brand("OrganizationId"));
export type OrganizationId = typeof OrganizationId.Type;
