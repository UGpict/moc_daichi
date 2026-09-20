import { NextResponse } from "next/server";
import { tokenCookieName } from "@/server/auth";
import { clearCarryCookies } from "@/server/repositories/storeCarry";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(tokenCookieName(), "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  clearCarryCookies(res);
  return res;
}
