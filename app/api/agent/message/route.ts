import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, speakerUserId, sessionId } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text" }, { status: 400 });
  }

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL ?? "http://127.0.0.1:18789";
  const upstream = await fetch(`${gatewayUrl}/api/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      channel: "family-voice",
      senderId: speakerUserId ?? "guest",
      context: { sessionId },
    }),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "Agent error" }, { status: 502 });
  }

  return NextResponse.json(await upstream.json());
}
