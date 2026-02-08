import { NextRequest, NextResponse } from "next/server";
import {
  clearAuthCookie,
  getSessionTokenFromRequest,
  removeSessionByRawToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  await removeSessionByRawToken(token);
  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}
