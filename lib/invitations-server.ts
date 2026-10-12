import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

/** Token del link: 32 bytes aleatorios en base64url (43 caracteres). */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Mismo hash que `invitation_token_hash` en la base (sha256 en hex). */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Link absoluto con el origen de la request actual (la Server Action la manda el navegador). */
export async function invitationLink(token: string): Promise<string> {
  const h = await headers();
  const origin =
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return `${origin}/invitacion/${token}`;
}
