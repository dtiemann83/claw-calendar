import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  let text: string | undefined;
  try {
    const body = await req.json();
    text = body.text;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text" }, { status: 400 });
  }

  const agentId = process.env.OPENCLAW_AGENT_ID ?? "main";
  const openclaw = process.env.OPENCLAW_BIN ?? "openclaw";

  try {
    const { stderr } = await execFileAsync(
      openclaw,
      ["agent", "--agent", agentId, "--local", "--json", "-m", text],
      { timeout: 60_000 }
    );
    const data = JSON.parse(stderr);
    const reply = data?.payloads?.[0]?.text ?? "";
    if (!reply) {
      console.error("[agent/message] Empty reply, stderr:", stderr.slice(0, 500));
      return NextResponse.json({ error: "Empty agent reply" }, { status: 502 });
    }
    return NextResponse.json({ text: reply });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    console.error("[agent/message] openclaw error:", e.message);
    if (e.stderr) console.error("[agent/message] stderr:", e.stderr.slice(0, 500));
    return NextResponse.json({ error: "Agent error" }, { status: 502 });
  }
}
