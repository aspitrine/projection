import { Schema } from "effect";

/** Aucune session valide. */
export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()("Unauthenticated", {}) {}

/** Session valide mais aucune organisation active (ou plus membre de celle-ci). */
export class NoActiveOrganization extends Schema.TaggedError<NoActiveOrganization>()(
  "NoActiveOrganization",
  {},
) {}
