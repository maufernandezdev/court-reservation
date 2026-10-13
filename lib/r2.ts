import "server-only";
import { AwsClient } from "aws4fetch";

/**
 * Acceso a Cloudflare R2 (API compatible con S3) solo desde el servidor.
 * Credenciales: token de API de R2 con Object Read & Write sobre el bucket.
 */
function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" }),
    base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
  };
}

/** ¿Están cargadas las credenciales de R2? */
export function isR2Configured(): boolean {
  return config() !== null;
}

function requireConfig() {
  const c = config();
  if (!c) throw new Error("Las fotos todavía no están configuradas en el servidor.");
  return c;
}

function objectUrl(base: string, key: string): string {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function putObject(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const { client, base } = requireConfig();
  const response = await client.fetch(objectUrl(base, key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  if (!response.ok) {
    throw new Error(`R2 PUT ${response.status}`);
  }
}

/** El objeto como respuesta (cuerpo en streaming), o null si no existe. */
export async function getObject(key: string): Promise<Response | null> {
  const { client, base } = requireConfig();
  const response = await client.fetch(objectUrl(base, key), { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`R2 GET ${response.status}`);
  }
  return response;
}

export async function deleteObject(key: string): Promise<void> {
  const { client, base } = requireConfig();
  const response = await client.fetch(objectUrl(base, key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 DELETE ${response.status}`);
  }
}
