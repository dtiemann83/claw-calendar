import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  const audioServerUrl = process.env.AUDIO_SERVER_URL ?? "http://127.0.0.1:3010";
  const upstream = await fetch(`${audioServerUrl}/stt`, {
    method: "POST",
    body: formData, // forward the whole formData
  });

  if (!upstream.ok) {
    const reason = await upstream.text().catch(() => "");
    console.error(`[voice/transcribe] STT error ${upstream.status}: ${reason}`);
    return NextResponse.json({ error: "STT failed" }, { status: 502 });
  }

  return NextResponse.json(await upstream.json());
}
