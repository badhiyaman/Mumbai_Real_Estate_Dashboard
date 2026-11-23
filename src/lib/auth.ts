// Admin sign-in for the edit pages. Server-side only.
//
// Signing in with ADMIN_PASSWORD sets an httpOnly cookie holding an HMAC of a fixed label, keyed by
// the password. The password itself is never stored in the cookie, and changing ADMIN_PASSWORD in
// the environment signs everyone out.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "admin_session";
export const SESSION_DAYS = 7;

function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update("mumbai-re-dashboard-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passwordMatches(input: string): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && safeEqual(input, pw);
}

export function sessionToken(): string {
  const t = expectedToken();
  if (!t) throw new Error("ADMIN_PASSWORD is not set");
  return t;
}

export async function isAdmin(): Promise<boolean> {
  const t = expectedToken();
  if (!t) return false;
  const c = (await cookies()).get(SESSION_COOKIE)?.value;
  return !!c && safeEqual(c, t);
}

/** Throws unless the current request is signed in. Call at the top of every write action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not signed in");
}
