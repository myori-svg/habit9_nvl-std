import mammoth from 'mammoth';
import { type NextRequest, NextResponse } from 'next/server';
import { parseChapters } from '@/lib/prompts';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'No file' }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const isDocx = file.name.toLowerCase().endsWith('.docx');
    const text = isDocx
      ? (await mammoth.extractRawText({ buffer })).value
      : buffer.toString('utf-8');

    const chapters = parseChapters(text);
    return NextResponse.json({ text, chapters });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
