import { NextResponse } from "next/server";
import { getEnv } from "@/config/env";
import { issueAnonymous, tokenCookieName } from "@/server/auth";
import { json } from "@/server/api/http";

export async function POST() {
  const env = getEnv();
  if (env.profile === "LIVE") {
    return json({ error: "LIVE では開発用匿名トークンを発行しません。Firebase Auth を使ってください" }, 403);
  }
  const { uid, token } = await issueAnonymous();
  const res = NextResponse.json({ uid, token, runtime: env.profile === "EMULATOR" ? "EMULATOR" : "DEV" });
  res.cookies.set(tokenCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
