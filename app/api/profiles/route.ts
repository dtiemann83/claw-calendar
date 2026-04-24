import { NextRequest, NextResponse } from "next/server";
import { getDb, profiles } from "@/db";
import { randomUUID } from "crypto";

export async function GET() {
  const db = getDb();
  const rows = db.select().from(profiles).orderBy(profiles.createdAt).all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const db = getDb();
  const id = randomUUID();
  const now = new Date();
  const [row] = db
    .insert(profiles)
    .values({
      id,
      name: body.name.trim(),
      color: body.color ?? "#3b82f6",
      avatarUrl: body.avatarUrl ?? null,
      createdAt: now,
    })
    .returning()
    .all();
  return NextResponse.json(row, { status: 201 });
}
