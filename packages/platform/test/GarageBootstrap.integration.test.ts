import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";

import { bootstrapGarage } from "../src/GarageBootstrap";

/**
 * Contre un vrai Garage v1.0.1, lancé vierge pour l'occasion :
 *
 *   docker run -d --name garage-test -p 13900:3900 -p 13903:3903 \
 *     -v ./garage-test.toml:/etc/garage.toml:ro dxflrs/garage:v1.0.1
 *
 * puis `GARAGE_TEST_ADMIN_URL=http://localhost:13903 GARAGE_TEST_ADMIN_TOKEN=… bun run test`.
 */
const adminUrl = process.env.GARAGE_TEST_ADMIN_URL;
const adminToken = process.env.GARAGE_TEST_ADMIN_TOKEN;

const config = {
  adminUrl: adminUrl ?? "",
  adminToken: Redacted.make(adminToken ?? ""),
  bucket: "projection",
  accessKeyId: "GK0123456789abcdef01234567",
  secretAccessKey: Redacted.make(
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  ),
  capacityBytes: 20_000_000_000,
};

const admin = (path: string) =>
  Effect.promise(() =>
    fetch(`${adminUrl}${path}`, { headers: { Authorization: `Bearer ${adminToken}` } }).then(
      (response) => response.json() as Promise<Record<string, unknown>>,
    ),
  );

describe.skipIf(!adminUrl || !adminToken)("bootstrapGarage (Garage réel)", () => {
  it.live(
    "rend un cluster vierge utilisable, puis ne change plus rien",
    () =>
      Effect.gen(function* () {
        yield* bootstrapGarage(config);

        const status = yield* admin("/v1/status");
        expect(status.layoutVersion).toBe(1);

        const bucket = yield* admin("/v1/bucket?globalAlias=projection");
        const keys = bucket.keys as ReadonlyArray<{
          accessKeyId: string;
          permissions: Record<string, boolean>;
        }>;
        expect(keys).toEqual([
          expect.objectContaining({
            accessKeyId: config.accessKeyId,
            permissions: { read: true, write: true, owner: true },
          }),
        ]);

        // Second démarrage du serveur : rien ne doit échouer ni être recréé.
        yield* bootstrapGarage(config);
        expect((yield* admin("/v1/status")).layoutVersion).toBe(1);
        expect((yield* admin("/v1/bucket?globalAlias=projection")).id).toBe(bucket.id);
      }),
    { timeout: 60_000 },
  );

  it.live("échoue aussitôt sur un jeton d'administration refusé", () =>
    Effect.gen(function* () {
      const error = yield* bootstrapGarage({
        ...config,
        adminToken: Redacted.make("mauvais-jeton"),
      }).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "GarageBootstrapError", step: "status", status: 403 });
    }),
  );
});
