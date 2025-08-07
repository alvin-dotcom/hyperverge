// src/lib/rubricPrompt.ts
export function getRubricPrompt(transcript: string) {
  return `
Evaluate this transcript for an interview question. Score from 1 to 5 on:
1. Content (accuracy/completeness)
2. Structure (organization, intro/conclusion)
3. Clarity (word choice, conciseness)
4. Delivery (pacing, tone, filler)

Return ONLY the following JSON object:

{
"scores": {
"content": [1-5],
"structure": [1-5],
"clarity": [1-5],
"delivery": [1-5]
},
"tips": [
  {
    "tip": "...",
    "reference": "line or timestamp reference"
  }
]
}

Transcript:
${transcript}
`.trim();
}