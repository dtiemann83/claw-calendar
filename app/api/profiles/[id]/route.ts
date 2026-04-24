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
