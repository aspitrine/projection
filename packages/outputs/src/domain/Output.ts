import { Frame } from "@projection/presentation/domain";
import { OrganizationId, OutputId } from "@projection/shared-kernel";
import { Effect, Schema } from "effect";

/** Types de sortie. MVP : salle ; retour scène et stream arrivent en T2.1. */
export const OutputType = Schema.Literals(["room"]);
export type OutputType = typeof OutputType.Type;

/** Secret d'accès d'un écran (256 bits, base64url). */
export const DisplayToken = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)).pipe(
  Schema.brand("DisplayToken"),
);
export type DisplayToken = typeof DisplayToken.Type;

export const isDisplayToken = Schema.is(DisplayToken);

export const generateDisplayToken = Effect.sync(() => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return DisplayToken.make(base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
});

export class Output extends Schema.Class<Output>("Output")({
  id: OutputId,
  organizationId: OrganizationId,
  name: Schema.NonEmptyString,
  type: OutputType,
  token: DisplayToken,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

/** Ce que reçoit un écran : l'image courante et l'identité de la sortie. */
export class DisplayFrame extends Schema.Class<DisplayFrame>("DisplayFrame")({
  outputName: Schema.String,
  outputType: OutputType,
  frame: Frame,
}) {}

export class OutputNotFound extends Schema.TaggedError<OutputNotFound>()("OutputNotFound", {
  id: OutputId,
}) {}

export class InvalidDisplayToken extends Schema.TaggedError<InvalidDisplayToken>()(
  "InvalidDisplayToken",
  {},
) {}
