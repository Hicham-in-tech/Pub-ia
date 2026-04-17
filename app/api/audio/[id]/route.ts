import { NextRequest, NextResponse } from "next/server";
import { getAudio } from "@/lib/audioCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const entry = getAudio(id);
  if (!entry) {
    return NextResponse.json({ error: "audio_not_found" }, { status: 404 });
  }
  const body = new Uint8Array(entry.bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": entry.mimeType,
      "content-length": String(entry.bytes.byteLength),
      "cache-control": "private, max-age=300",
      "accept-ranges": "bytes",
    },
  });
}
