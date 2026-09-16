import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";

/** Durées de vie des URL signées : assez courtes pour ne pas circuler. */
export const UPLOAD_URL_TTL_SECONDS = 600;
export const DOWNLOAD_URL_TTL_SECONDS = 900;

export class ObjectStorageError extends Schema.TaggedError<ObjectStorageError>()(
  "ObjectStorageError",
  { operation: Schema.String },
) {}

/**
 * Stockage S3 compatible (Garage en développement et en auto-hébergement).
 * Le serveur ne transporte pas les fichiers : il signe des URL que le navigateur utilise.
 */
export class ObjectStorage extends Context.Service<
  ObjectStorage,
  {
    presignUpload(key: string, contentType: string): Effect.Effect<string, ObjectStorageError>;
    presignDownload(key: string, expiresIn?: number): Effect.Effect<string, ObjectStorageError>;
    remove(key: string): Effect.Effect<void, ObjectStorageError>;
  }
>()("@projection/platform/ObjectStorage") {
  static readonly layerConfig = Layer.effect(
    ObjectStorage,
    Effect.gen(function* () {
      const endpoint = yield* Config.String("S3_ENDPOINT");
      const region = yield* Config.String("S3_REGION").pipe(Config.withDefault("garage"));
      const bucket = yield* Config.String("S3_BUCKET");
      const accessKeyId = yield* Config.String("S3_ACCESS_KEY_ID");
      const secretAccessKey = yield* Config.Redacted("S3_SECRET_ACCESS_KEY");

      const client = new S3Client({
        endpoint,
        region,
        // Garage (comme MinIO) expose les buckets dans le chemin, pas en sous-domaine.
        forcePathStyle: true,
        // Sans cela, le SDK glisse un checksum CRC32 dans l'URL signée, que Garage refuse.
        requestChecksumCalculation: "WHEN_REQUIRED",
        credentials: { accessKeyId, secretAccessKey: Redacted.value(secretAccessKey) },
      });

      const attempt = <A>(operation: string, run: () => Promise<A>) =>
        Effect.tryPromise({
          try: run,
          catch: () => new ObjectStorageError({ operation }),
        }).pipe(Effect.withSpan(`ObjectStorage.${operation}`));

      return ObjectStorage.of({
        presignUpload: (key, contentType) =>
          attempt("presignUpload", () =>
            getSignedUrl(
              client,
              new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
              {
                expiresIn: UPLOAD_URL_TTL_SECONDS,
              },
            ),
          ),
        presignDownload: (key, expiresIn = DOWNLOAD_URL_TTL_SECONDS) =>
          attempt("presignDownload", () =>
            getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn }),
          ),
        remove: (key) =>
          attempt("remove", () =>
            client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
          ).pipe(Effect.asVoid),
      });
    }),
  );
}
