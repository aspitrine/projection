import { useAtomValue } from "@effect/atom-react";
import {
  type Branding,
  type OutputType,
  type SlideBackground,
  brandingFor,
  defaultThemeFor,
} from "@projection/outputs/domain";
import {
  type Cover,
  Frame,
  type FrameContent,
  type SlideTheme,
} from "@projection/presentation/domain";
import { MediaId, type ProjectId } from "@projection/shared-kernel";
import type { ReactNode } from "react";

import { FadingFrame } from "@/features/display/fading-frame";
import { contentToSlide } from "@/features/display/frame";
import { mediaListAtom, mediaUrlAtom } from "@/features/media/atoms";
import { SlideRenderer } from "@/features/presentation/slide-renderer";
import { authClient } from "@/lib/auth-client";

import { outputsListAtom } from "./atoms";

/** Thème de la première sortie du type dans le projet, ou thème par défaut du type. */
export const useOutputTheme = (projectId: ProjectId, type: OutputType): SlideTheme => {
  const outputs = useAtomValue(outputsListAtom(projectId));
  const output =
    outputs._tag === "Success" ? outputs.value.find((candidate) => candidate.type === type) : null;
  return output?.theme ?? defaultThemeFor(type);
};

/**
 * Aperçu fidèle d'une sortie dans la régie : thème, fond, logo et fondu de la sortie
 * du projet, comme sur son écran.
 */
export function OutputPreview({
  projectId,
  type,
  content,
  cover,
}: {
  projectId: ProjectId;
  type: OutputType;
  content: FrameContent;
  cover: Cover;
}) {
  const theme = useOutputTheme(projectId, type);
  const { data: organization } = authClient.useActiveOrganization();
  const organizationBranding: Branding = {
    name: organization?.name ?? "",
    logoUrl: organization?.logo ?? null,
  };
  const logoMediaId = theme.logo?._tag === "Image" ? theme.logo.mediaId : null;

  return (
    <ResolvedMedia mediaId={theme.backgroundMediaId}>
      {(background) => (
        <ResolvedMedia mediaId={logoMediaId}>
          {(logoImage) => (
            <FadingFrame
              frame={new Frame({ version: 0, cover, content, updatedAt: 0 })}
              type={type}
              theme={theme}
              background={background}
              branding={brandingFor(organizationBranding, theme.logo, logoImage)}
            />
          )}
        </ResolvedMedia>
      )}
    </ResolvedMedia>
  );
}

/** Diapo avec le thème et le fond d'une sortie du projet : cartes et aperçus de la régie. */
export function ThemedSlide({
  projectId,
  content,
  type = "room",
}: {
  projectId: ProjectId;
  content: FrameContent;
  type?: OutputType;
}) {
  const theme = useOutputTheme(projectId, type);
  return (
    <ResolvedMedia mediaId={theme.backgroundMediaId}>
      {(background) => (
        <SlideRenderer
          theme={theme}
          background={background}
          slide={contentToSlide(content)}
          referencePlacement={type === "stream" ? "below" : "bottom"}
        />
      )}
    </ResolvedMedia>
  );
}

/** Résout un média de la bibliothèque en URL signée ; `null` tant qu'il n'est pas disponible. */
function ResolvedMedia({
  mediaId,
  children,
}: {
  mediaId: string | null;
  children: (media: SlideBackground | null) => ReactNode;
}) {
  return mediaId === null ? (
    children(null)
  ) : (
    <SignedMedia mediaId={MediaId.make(mediaId)}>{children}</SignedMedia>
  );
}

function SignedMedia({
  mediaId,
  children,
}: {
  mediaId: MediaId;
  children: (media: SlideBackground | null) => ReactNode;
}) {
  const url = useAtomValue(mediaUrlAtom(mediaId));
  const library = useAtomValue(mediaListAtom);
  const asset =
    library._tag === "Success"
      ? library.value.find((candidate) => candidate.id === mediaId)
      : undefined;
  return children(
    url._tag === "Success" && asset !== undefined
      ? { url: url.value, video: asset.kind === "video" }
      : null,
  );
}
