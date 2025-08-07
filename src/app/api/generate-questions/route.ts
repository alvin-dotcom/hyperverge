import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const getTextFromFile = async (file: File): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer());

  // PDF
  if (file.type === 'application/pdf' || file.name?.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  // DOCX
  if (file.name?.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  // Plaintext
  return buffer.toString('utf8');
};

// THIS IS THE IMPORTANT PART!
export async function POST(req: NextRequest) {
  try {
    let topic = '';
    let resumeText = '';

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File;
      topic = (form.get("topic") as string) || "";

      if (file && file.size > 0) {
        try {
          resumeText = await getTextFromFile(file);
        } catch (e: any) {
          console.error("Resume file parse error", e);
          return NextResponse.json({ error: "Failed to parse resume file." }, { status: 400 });
        }
      }
    } else {
      const data = await req.json().catch(() => ({}));
      topic = data.topic || "";
    }

    if (!resumeText && !topic) {
      return NextResponse.json({ error: "Please provide a topic or upload a resume." }, { status: 400 });
    }

    // ==== Compose GPT prompt ====
    let prompt = "";
    if (resumeText) {
      prompt = `
Based on the following resume, generate 10 personalized and diverse job interview questions relevant to the candidate.
Return only a JSON array of question strings.
Resume:
${resumeText.substring(0, 7000)}
`.trim();
    } else if (topic) {
      prompt = `
Generate 10 varied interview questions for someone preparing for this topic/role:
"${topic}"
Return as a JSON array of strings.
`.trim();
    }

    // ==== Call OpenAI ====
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.5,
        messages: [
          { role: "system", content: "You are a knowledgeable interview coach." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      console.error("OpenAI API error", await response.text());
      return NextResponse.json({ error: "OpenAI request failed." }, { status: 500 });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    let questions: string[] = [];

    // Try to extract as JSON
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) questions = parsed;
      else if (typeof parsed === "object" && parsed.questions) questions = parsed.questions;
    } catch {
      questions = content.split('\n').filter(q => q.trim()).map(q => q.replace(/^[0-9\-\.\)]+\s*/, ''));
    }
    return NextResponse.json({ questions: questions.slice(0, 10) });

  } catch (err) {
    console.error("Internal server error", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}