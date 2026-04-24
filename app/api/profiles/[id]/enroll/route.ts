import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  const audioServerUrl = process.env.AUDIO_SERVER_URL ?? "http://127.0.0.1:3010";
  const upstream = await fetch(`${audioServerUrl}/enroll?user_id=${encodeURIComponent(id)}`, {
    method: "POST",
    body: formData,
  });

  if (!upstream.ok) {
    const reason = await upstream.text().catch(() => "");
    console.error(`[profiles/enroll] error ${upstream.status}: ${reason}`);
    return NextResponse.json({ error: "Enrollment failed" }, { status: 502 });
  }

  return NextResponse.json(await upstream.json());
}
