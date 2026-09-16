import { MEDIA_DISPLAY_TTL_SECONDS } from "@projection/media/domain";
import { Media } from "@projection/media/server";
import type { SlideBackground } from "@projection/outputs/domain";
import { ThemeBackgrounds } from "@projection/outputs/server";
import { MediaId, type OrganizationId } from "@projection/shared-kernel";
import { Clock, Effect, Layer, Option } from "effect";

/**
 * Les URL signées sont mémorisées la moitié de leur durée de vie : un écran reçoit
 * plusieurs images par minute (battements compris) et rechargerait son fond à chaque
 * fois si l'URL changeait. Le cache vaut pour le processus, comme l'état de la régie.
 */
const CACHE_MS = (MEDIA_DISPLAY_TTL_SECONDS * 1000) / 2;

/** Résout le fond d'un thème en URL signée, via la médiathèque de l'organisation. */
export const ThemeBackgroundsLive = Layer.effect(
  ThemeBackgrounds,
  Effect.gen(function* () {
    const media = yield* Media;
    const cache = new Map<
      string,
      { readonly background: SlideBackground; readonly until: number }
    >();

    return ThemeBackgrounds.of({
      resolve: Effect.fn("ThemeBackgrounds.resolve")(function* (
        organizationId: OrganizationId,
        mediaId: string,
      ) {
        const key = `${organizationId}:${mediaId}`;
        const now = yield* Clock.currentTimeMillis;
        const cached = cache.get(key);
        if (cached !== undefined && cached.until > now) return Option.some(cached.background);

        const resolved = yield* media.resolveFor(
          organizationId,
          MediaId.make(mediaId),
          MEDIA_DISPLAY_TTL_SECONDS,
        );
        if (Option.isNone(resolved)) {
          // Média supprimé : l'écran retombe sur la couleur de fond du thème.
          cache.delete(key);
          return Option.none<SlideBackground>();
        }
        const background: SlideBackground = {
          url: resolved.value.url,
          video: resolved.value.asset.kind === "video",
        };
        cache.set(key, { background, until: now + CACHE_MS });
        return Option.some(background);
      }),
    });
  }),
);
