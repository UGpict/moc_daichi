import { NextResponse } from "next/server";
import { tokenCookieName } from "@/server/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(tokenCookieName(), "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
