import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let text: string | undefined;
  let speakerUserId: string | undefined;
  let sessionId: string | undefined;
  try {
    const body = await req.json();
    text = body.text;
    speakerUserId = body.speakerUserId;
    sessionId = body.sessionId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
    const reason = await upstream.text().catch(() => "");
    console.error(`[agent/message] Gateway error ${upstream.status}: ${reason}`);
    return NextResponse.json({ error: "Agent error" }, { status: 502 });
  }

  return NextResponse.json(await upstream.json());
}
