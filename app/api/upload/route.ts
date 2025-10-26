import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll('file');
    const urls: string[] = [];
    for (const f of files) {
      if (!(f instanceof File)) continue;
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const { url } = await put(`patio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, f, {
        access: 'public',
      });
      urls.push(url);
    }
    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'upload failed' }, { status: 400 });
  }
}