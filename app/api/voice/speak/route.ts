import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let text: string | undefined;
  let voice: string | undefined;
  try {
    const body = await req.json();
    text = body.text;
    voice = body.voice;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text" }, { status: 400 });
  }

  const audioServerUrl = process.env.AUDIO_SERVER_URL ?? "http://127.0.0.1:8080";
  const upstream = await fetch(`${audioServerUrl}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!upstream.ok) {
    const reason = await upstream.text().catch(() => "");
    console.error(`[voice/speak] TTS error ${upstream.status}: ${reason}`);
    return NextResponse.json({ error: "TTS failed" }, { status: 502 });
  }

  const audioBuffer = await upstream.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/wav",
    },
  });
}
