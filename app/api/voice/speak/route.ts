import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, voice } = await req.json();
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
    return NextResponse.json({ error: "TTS failed" }, { status: 502 });
  }

  const audioBuffer = await upstream.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: { "Content-Type": "audio/wav" },
  });
}
