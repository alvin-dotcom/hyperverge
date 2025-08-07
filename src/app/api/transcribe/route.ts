import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// For edge functions, we use the File object directly from FormData.
export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file = data.get("audio") as File;

    if (!file) return NextResponse.json({ error: "No audio file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = `/tmp/${file.name}`;
    fs.writeFileSync(tempPath, buffer);

    // Prepare for Whisper API
    const fetchRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: (() => {
        const form = new FormData();
        form.append("file", fs.createReadStream(tempPath), file.name);
        form.append("model", "whisper-1");
        form.append("response_format", "verbose_json"); // includes segments!
        return form;
      })(),
    });
    const result = await fetchRes.json();

    fs.unlinkSync(tempPath);

    if (result.error)
      return NextResponse.json({ error: result.error.message }, { status: 400 });

    return NextResponse.json({
      transcript: result.text,
      segments: result.segments, // [{text, start, end}, ...]
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "STT error" }, { status: 500 });
  }
}