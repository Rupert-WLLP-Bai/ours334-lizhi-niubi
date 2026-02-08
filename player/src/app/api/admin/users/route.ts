import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  getUserFromRawSessionToken,
  hashPassword,
} from "@/lib/auth";
import { createUser, getUserByAccount } from "@/lib/userLibraryStoreSupabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function readString(value: unknown, maxLength = 320): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  const currentUser = await getUserFromRawSessionToken(token);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const account =
    readString(data.account)?.toLowerCase() ??
    readString(data.email)?.toLowerCase() ??
    null;
  const password = readString(data.password, 200);
  const role = readString(data.role, 20) === "admin" ? "admin" : "user";

  if (!account || !password) {
    return NextResponse.json({ error: "Account and password are required" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  }
  if (await getUserByAccount(account)) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const user = await createUser({
    email: account,
    passwordHash: hashPassword(password),
    role,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
}
