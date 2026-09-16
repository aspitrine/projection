import { Effect, Redacted, Schedule, Schema } from "effect";

/**
 * Initialisation d'un Garage neuf, par son API d'administration (v1).
 *
 * Un cluster Garage fraîchement démarré ne sert rien : il lui faut une disposition
 * (le nœud, sa zone, sa capacité), une clé d'accès et un bucket autorisé pour cette clé.
 * Sans cela, il répète « Ring not yet ready » et toute écriture est perdue. Ces étapes se
 * font d'ordinaire en ligne de commande dans le conteneur ; les confier au serveur au
 * démarrage épargne à chaque installation auto-hébergée une manipulation manuelle.
 *
 * Chaque étape vérifie l'état avant d'agir : relancer l'initialisation sur un cluster
 * déjà prêt ne modifie rien.
 */
export interface GarageBootstrapConfig {
  /** API d'administration, joignable par le serveur seulement (ex. `http://garage:3903`). */
  readonly adminUrl: string;
  readonly adminToken: Redacted.Redacted;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: Redacted.Redacted;
  /** Capacité annoncée pour le nœud, en octets. */
  readonly capacityBytes: number;
}

export class GarageBootstrapError extends Schema.TaggedError<GarageBootstrapError>()(
  "GarageBootstrapError",
  { step: Schema.String, status: Schema.NullOr(Schema.Number) },
) {}

const Status = Schema.Struct({
  node: Schema.String,
  layoutVersion: Schema.Number,
  nodes: Schema.Array(Schema.Struct({ id: Schema.String, role: Schema.NullOr(Schema.Unknown) })),
});

const Bucket = Schema.Struct({ id: Schema.String });

/**
 * Délai laissé à Garage pour démarrer quand le serveur le devance. Seule
 * l'indisponibilité est réessayée : un jeton refusé ne s'arrangera pas en attendant.
 */
const readiness = {
  schedule: Schedule.spaced("3 seconds"),
  times: 20,
  while: (error: GarageBootstrapError) => error.status === null || error.status >= 500,
};

export const bootstrapGarage = (config: GarageBootstrapConfig) =>
  Effect.gen(function* () {
    const call = (step: string, method: string, path: string, body?: unknown) =>
      Effect.tryPromise({
        try: () =>
          fetch(`${config.adminUrl}${path}`, {
            method,
            headers: {
              Authorization: `Bearer ${Redacted.value(config.adminToken)}`,
              ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        catch: () => new GarageBootstrapError({ step, status: null }),
      });

    const expectOk = (step: string, response: Response) =>
      response.ok
        ? Effect.succeed(response)
        : Effect.fail(new GarageBootstrapError({ step, status: response.status }));

    const json = <A>(step: string, schema: Schema.Codec<A, unknown>, response: Response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: () => new GarageBootstrapError({ step, status: response.status }),
      }).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(schema)),
        Effect.mapError(() => new GarageBootstrapError({ step, status: response.status })),
      );

    // 1. Disposition : le nœud n'a pas de rôle tant qu'aucune disposition n'est appliquée.
    //    Réessayé : au démarrage de la pile, Garage peut ne pas encore répondre.
    const status = yield* call("status", "GET", "/v1/status").pipe(
      Effect.flatMap((response) => expectOk("status", response)),
      Effect.flatMap((response) => json("status", Status, response)),
      Effect.retry(readiness),
    );
    const self = status.nodes.find((node) => node.id === status.node);
    if (self !== undefined && self.role === null) {
      yield* call("layout", "POST", "/v1/layout", [
        { id: status.node, zone: "dc1", capacity: config.capacityBytes, tags: [] },
      ]).pipe(Effect.flatMap((response) => expectOk("layout", response)));
      yield* call("layout-apply", "POST", "/v1/layout/apply", {
        version: status.layoutVersion + 1,
      }).pipe(Effect.flatMap((response) => expectOk("layout-apply", response)));
      yield* Effect.logInfo("Garage : disposition du cluster appliquée");
    }

    // 2. Clé d'accès : Garage refuse de réimporter un identifiant connu, on vérifie d'abord.
    //    Une clé inconnue répond 400, pas 404.
    const key = yield* call("key", "GET", `/v1/key?id=${encodeURIComponent(config.accessKeyId)}`);
    if (!key.ok) {
      yield* call("key-import", "POST", "/v1/key/import", {
        accessKeyId: config.accessKeyId,
        secretAccessKey: Redacted.value(config.secretAccessKey),
        name: config.bucket,
      }).pipe(Effect.flatMap((response) => expectOk("key-import", response)));
      yield* Effect.logInfo("Garage : clé d'accès importée");
    }

    // 3. Bucket, retrouvé par son alias ou créé.
    const existing = yield* call(
      "bucket",
      "GET",
      `/v1/bucket?globalAlias=${encodeURIComponent(config.bucket)}`,
    );
    const bucket = existing.ok
      ? yield* json("bucket", Bucket, existing)
      : yield* call("bucket-create", "POST", "/v1/bucket", { globalAlias: config.bucket }).pipe(
          Effect.flatMap((response) => expectOk("bucket-create", response)),
          Effect.flatMap((response) => json("bucket-create", Bucket, response)),
          Effect.tap(() => Effect.logInfo(`Garage : bucket ${config.bucket} créé`)),
        );

    // 4. Droits de la clé sur le bucket ; `owner` autorise aussi la pose des règles CORS.
    //    Accorder un droit déjà accordé ne change rien.
    yield* call("bucket-allow", "POST", "/v1/bucket/allow", {
      bucketId: bucket.id,
      accessKeyId: config.accessKeyId,
      permissions: { read: true, write: true, owner: true },
    }).pipe(Effect.flatMap((response) => expectOk("bucket-allow", response)));
  }).pipe(Effect.withSpan("GarageBootstrap"));
