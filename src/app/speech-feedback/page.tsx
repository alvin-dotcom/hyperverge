"use client";
import { useState } from "react";
import { getRandomPrompt } from "@/lib/promptBank";
const DEFAULT_QUESTION = "How do you handle disagreements within your team?";

export default function SpeechFeedbackPractice() {
  const [prompt, setPrompt] = useState(DEFAULT_QUESTION);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-900 pt-8 sm:pt-14 flex justify-center items-center transition-colors">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-700 p-6 sm:p-10 w-full max-w-2xl mx-4 transition-colors">
        <div className="text-center text-gray-500 dark:text-zinc-400 text-md mb-2 font-medium tracking-wide">
          Interview Question
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 text-gray-900 dark:text-white">
          {prompt}
        </h2>
        <div className="flex flex-col items-center">
          <button
            className="
              w-40 h-40 sm:w-56 sm:h-56 bg-blue-600 hover:bg-blue-700 active:scale-95 
              focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/60
              text-white rounded-full flex items-center justify-center 
              text-5xl mb-6 shadow-2xl transition-all relative
              animate-pulse
            "
            style={{ border: "none" }}
            aria-label="Record your answer"
            // TODO: Wire up audio functionality
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={56}
              height={56}
              fill="white"
              viewBox="0 0 24 24"
            >
              <path d="M12 17a4 4 0 0 0 4-4V7a4 4 0 0 0-8 0v6a4 4 0 0 0 4 4Zm6-4a1 1 0 0 0-2 0 6 6 0 1 1-12 0 1 1 0 1 0-2 0c0 4.396 3.581 8 8 8s8-3.604 8-8Z" />
            </svg>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white opacity-80 tracking-wide font-semibold">
              Record
            </span>
          </button>
          {/* Status and Timer */}
          <div className="w-full flex flex-col xs:flex-row justify-between items-center gap-0.5 xs:gap-1 text-sm sm:text-base text-gray-600 dark:text-zinc-300 mt-1">
            <span className="font-medium">Ready to record</span>
            <span className="tracking-wide font-mono">1:00</span>
          </div>
          {/* Timer bar */}
          <div className="w-full h-3 bg-gray-200 dark:bg-zinc-700 rounded-lg mt-3 overflow-hidden">
            <div
              className="h-3 bg-blue-400 dark:bg-blue-600 transition-all"
              style={{ width: "100%" }} // Replace with dynamic width if you wire up timer
            />
          </div>
        </div>
      </div>
    </div>
  );
}