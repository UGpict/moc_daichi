import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { getEnv } = await import("@/config/env");
    const { issueAnonymous, tokenCookieName } = await import("@/server/auth");
    const env = getEnv();
    if (env.profile === "LIVE") {
      return NextResponse.json(
        { error: "LIVE では開発用匿名トークンを発行しません。Firebase Auth を使ってください" },
        { status: 403 },
      );
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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ゲストログインに失敗しました" },
      { status: 500 },
    );
  }
}
