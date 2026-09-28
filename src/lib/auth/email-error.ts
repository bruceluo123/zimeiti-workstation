import { NextResponse } from "next/server";

type AuthEmailError = {
  code?: string;
  status?: number;
};

export function authEmailErrorResponse(error: AuthEmailError, fallback: string) {
  const rateLimited = error.status === 429 || error.code === "over_email_send_rate_limit";
  if (rateLimited) {
    return NextResponse.json(
      { error: "邮件发送额度已满，请约 1 小时后再试；重复点击不会提前恢复" },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 502 });
}
