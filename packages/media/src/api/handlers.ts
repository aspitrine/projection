import { Effect } from "effect";

import { Media } from "../application/Media";
import { MediaRpcs } from "./contract";

export const MediaHandlersLive = MediaRpcs.toLayer(
  Effect.gen(function* () {
    const media = yield* Media;

    return {
      MediaList: () => media.list,
      MediaRequestUpload: (input) => media.requestUpload(input),
      MediaConfirmUpload: ({ id }) => media.confirmUpload(id),
      MediaUrl: ({ id }) => media.url(id),
      MediaRename: ({ id, name }) => media.rename(id, name),
      MediaDelete: ({ id }) => media.remove(id),
    };
  }),
);
