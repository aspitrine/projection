import {
  Frame,
  SlideTheme,
  Splitting,
  type Track,
  roomSplitting,
  streamSplitting,
} from "@projection/presentation/domain";
import { OrganizationId, OutputId } from "@projection/shared-kernel";
import { Effect, Schema } from "effect";

/** Types de sortie : projecteur, retour scène, stream (lower third transparent). */
export const OutputType = Schema.Literals(["room", "stage", "stream"]);
export type OutputType = typeof OutputType.Type;

/** Piste qui alimente une sortie : la salle pilote salle et retour, le stream a sa piste. */
export const trackOf = (type: OutputType): Track => (type === "stream" ? "stream" : "room");

export const OutputName = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(60),
);

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
  /** Thème propre à la sortie ; `null` : thème par défaut de son type. */
  theme: Schema.NullOr(SlideTheme),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

/** Découpage par piste pour une organisation. */
export const SplittingSettings = Schema.Struct({ room: Splitting, stream: Splitting });
export type SplittingSettings = typeof SplittingSettings.Type;

export const defaultSplittingSettings: SplittingSettings = {
  room: roomSplitting,
  stream: streamSplitting,
};

/** Identité visuelle de l'organisation, affichée par le bouton « logo ». */
export const Branding = Schema.Struct({
  name: Schema.String,
  logoUrl: Schema.NullOr(Schema.String),
});
export type Branding = typeof Branding.Type;

/** Fond de diapo résolu : URL signée du média et nature du fichier. */
export const SlideBackground = Schema.Struct({
  url: Schema.String,
  video: Schema.Boolean,
});
export type SlideBackground = typeof SlideBackground.Type;

/** Ce que reçoit un écran : l'image courante et l'identité de la sortie. */
export class DisplayFrame extends Schema.Class<DisplayFrame>("DisplayFrame")({
  outputName: Schema.String,
  outputType: OutputType,
  /** Thème résolu (personnalisé ou par défaut) : l'écran n'a rien à décider. */
  theme: SlideTheme,
  /** Fond du thème, déjà signé ; `null` si le thème n'en a pas ou si le média a disparu. */
  background: Schema.NullOr(SlideBackground),
  branding: Branding,
  frame: Frame,
}) {}

export class OutputNotFound extends Schema.TaggedError<OutputNotFound>()("OutputNotFound", {
  id: OutputId,
}) {}

/** Une organisation garde toujours au moins une sortie. */
export class LastOutput extends Schema.TaggedError<LastOutput>()("LastOutput", {
  id: OutputId,
}) {}

export class InvalidDisplayToken extends Schema.TaggedError<InvalidDisplayToken>()(
  "InvalidDisplayToken",
  {},
) {}
