import { Effect } from "effect";

import { Songs } from "../application/Songs";
import { SongsRpcs } from "./contract";

export const SongsHandlersLive = SongsRpcs.toLayer(
  Effect.gen(function* () {
    const songs = yield* Songs;

    return {
      SongsList: ({ search }) => songs.list(search),
      SongsGet: ({ id }) => songs.get(id),
      SongsCreate: (input) => songs.create(input),
      SongsUpdate: ({ id, input }) => songs.update(id, input),
      SongsDelete: ({ id }) => songs.remove(id),
    };
  }),
);
