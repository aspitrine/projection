import { useAtomValue } from "@effect/atom-react";
import type { MediaAsset } from "@projection/media/domain";
import { cn } from "@projection/ui/lib/utils";

import { m } from "@/paraglide/messages";

import { mediaUrlAtom } from "./atoms";

/** Aperçu d'un média : l'URL de lecture est signée par le serveur, à durée de vie courte. */
export function MediaPreview({ asset, className }: { asset: MediaAsset; className?: string }) {
  const url = useAtomValue(mediaUrlAtom(asset.id));

  if (url._tag !== "Success") {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground grid aspect-video place-items-center text-xs",
          className,
        )}
      >
        {url._tag === "Failure" ? m.media_preview_error() : "…"}
      </div>
    );
  }

  return asset.kind === "image" ? (
    <img
      src={url.value}
      alt={asset.name}
      className={cn("aspect-video w-full bg-black object-contain", className)}
    />
  ) : (
    <video
      src={url.value}
      controls
      preload="metadata"
      className={cn("aspect-video w-full bg-black object-contain", className)}
    />
  );
}
