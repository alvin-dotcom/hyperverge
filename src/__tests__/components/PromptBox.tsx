'use client'
import React from "react";

type Props = {
  prompt: string;
  onNextPrompt: () => void;
};

export function PromptBox({ prompt, onNextPrompt }: Props) {
  return (
    <div className="mb-4">
      <span className="font-semibold">Prompt:</span> {prompt}
      <button onClick={onNextPrompt} className="ml-4 text-sm px-2 py-1 bg-slate-200 rounded">New Prompt</button>
    </div>
  );
}