/**
 * Autorise le navigateur à téléverser et lire directement dans le bucket.
 * Sans ces règles CORS, le PUT signé échoue depuis l'application.
 *
 * Usage : `bun run storage:cors` (origines supplémentaires : `--origin https://…`).
 */
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const env = (name: string) => {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`Variable ${name} manquante`);
  return value;
};

const extraOrigins = process.argv
  .slice(2)
  .flatMap((arg, index, all) =>
    arg === "--origin" && all[index + 1] !== undefined ? [all[index + 1]!] : [],
  );
const origins = [...new Set([env("BETTER_AUTH_URL"), ...extraOrigins])];

const client = new S3Client({
  endpoint: env("S3_ENDPOINT"),
  region: env("S3_REGION"),
  forcePathStyle: true,
  credentials: {
    accessKeyId: env("S3_ACCESS_KEY_ID"),
    secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
  },
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: env("S3_BUCKET"),
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: origins,
          AllowedMethods: ["GET", "PUT", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

console.log(`Règles CORS appliquées pour : ${origins.join(", ")}`);
