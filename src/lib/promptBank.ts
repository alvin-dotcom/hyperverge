// src/lib/promptBank.ts
export const PROMPTS = [
  { id: 'lru', type: 'cs', prompt: 'Pitch the LRU cache in ≤60 seconds.' },
  { id: 'stack', type: 'cs', prompt: 'Explain how a stack works.' },
  { id: 'os', type: 'cs', prompt: 'What is process scheduling in OS?' },
  { id: 'strength', type: 'hr', prompt: 'What are your key strengths?' },
  { id: 'weakness', type: 'hr', prompt: 'What’s a weakness you’re working on?' },
  // ...add as many as you like
];

export function getRandomPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}