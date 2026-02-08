import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createAuthSession,
  deleteAuthSession,
  getSessionUserByTokenHash,
  getUserById,
} from "@/lib/userLibraryStoreSupabase";

export const AUTH_COOKIE_NAME = "lizhi_auth_session";
const DEFAULT_SESSION_DAYS = 14;

function toSafePositiveInt(value: string | undefined, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.trunc(num);
}

export function getSessionMaxAgeSeconds(): number {
  const days = toSafePositiveInt(process.env.AUTH_SESSION_DAYS, DEFAULT_SESSION_DAYS);
  return days * 24 * 60 * 60;
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPassword(password: string): string {
  const normalized = String(password ?? "");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(normalized, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = String(storedHash ?? "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const expectedHash = parts[2];
  if (!salt || !expectedHash) return false;
  const actualHash = crypto.scryptSync(String(password ?? ""), salt, 64).toString("hex");
  return safeCompare(actualHash, expectedHash);
}

export async function createPersistedSession(userId: number) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const maxAge = getSessionMaxAgeSeconds();
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString();
  await createAuthSession({
    userId,
    tokenHash,
    expiresAt,
  });
  return { token, maxAge };
}

export function getSessionTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export function setAuthCookie(response: NextResponse, token: string, maxAge: number): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  });
}

export async function removeSessionByRawToken(rawToken: string | null): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await deleteAuthSession(tokenHash);
}

export async function getUserFromRawSessionToken(rawToken: string | null) {
  if (!rawToken) return null;
  const tokenHash = hashSessionToken(rawToken);
  return getSessionUserByTokenHash(tokenHash);
}

export async function getCurrentUserFromServerCookies() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
  if (!rawToken) return null;
  return await getUserFromRawSessionToken(rawToken);
}

export async function getCurrentUserById(userId: number | null | undefined) {
  if (typeof userId !== "number" || !Number.isFinite(userId)) return null;
  return await getUserById(userId);
}
