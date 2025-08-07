import { NextRequest, NextResponse } from "next/server";
import { getRubricPrompt } from "@/lib/rubricPrompt";

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();

  if (!transcript)
    return NextResponse.json({ error: "No transcript provided" }, { status: 400 });

  const messages = [
    { role: "system", content: "You are an interview evaluator." },
    { role: "user", content: getRubricPrompt(transcript) },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4", // gpt-3.5-turbo is cheaper, but less reliable at rubric tasks
      messages,
      temperature: 0.3,
      max_tokens: 512,
    }),
  });
  const data = await response.json();

  let content = data.choices?.[0]?.message?.content ?? "";
  let jsonResult = null;
  try {
    // Try to extract the JSON from the response.
    const match = content.match(/\{[\s\S]+\}/);
    const jsonStr = match ? match[0] : content;
    jsonResult = JSON.parse(jsonStr);
  } catch (e) {
    return NextResponse.json({ error: "Could not parse feedback", raw: content }, { status: 400 });
  }
  return NextResponse.json(jsonResult);
}