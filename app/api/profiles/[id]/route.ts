import { NextRequest, NextResponse } from "next/server";
import { getDb, profiles } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const [row] = db.select().from(profiles).where(eq(profiles.id, id)).all();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const deleted = db.delete(profiles).where(eq(profiles.id, id)).returning().all();
  if (!deleted.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const patch: Partial<{ name: string; color: string }> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.color === "string") patch.color = body.color;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const db = getDb();
  const updated = db.update(profiles).set(patch).where(eq(profiles.id, id)).returning().all();
  if (!updated.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated[0]);
}
