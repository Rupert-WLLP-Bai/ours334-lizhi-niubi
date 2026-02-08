import { NextRequest, NextResponse } from "next/server";
import {
  createPersistedSession,
  setAuthCookie,
  verifyPassword,
} from "@/lib/auth";
import { getUserByAccount } from "@/lib/userLibraryStore";

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
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = (payload ?? {}) as Record<string, unknown>;
  const account =
    readString(data.account, 320)?.toLowerCase() ??
    readString(data.email, 320)?.toLowerCase() ??
    null;
  const password = readString(data.password, 200);

  if (!account || !password) {
    return NextResponse.json({ error: "Account and password are required" }, { status: 400 });
  }

  const user = getUserByAccount(account);
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid account or password" }, { status: 401 });
  }

  const session = createPersistedSession(user.id);
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
  setAuthCookie(response, session.token, session.maxAge);
  return response;
}
