'use client'
import { useState } from "react";
import { getRandomPrompt } from "@/lib/promptBank";
import { AudioRecorder } from "../components/AudioRecorder";
import { PromptBox } from "../components/PromptBox";
import { TranscriptHighlighter } from "../components/TranscriptHighlighter";
import { FeedbackPanel } from "../components/FeedbackPanel";

type Segment = { text: string; start: number; end: number };
type Tip = { tip: string; reference: string };

export default function SpeechFeedbackPage() {
  const [promptObj, setPromptObj] = useState(getRandomPrompt());
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  function nextPrompt() {
    setPromptObj(getRandomPrompt());
    setTranscript("");
    setSegments([]);
    setFeedback(null);
    setAudioFile(null);
  }

  async function handleAudio(file: File) {
    setAudioFile(file);
    setTranscript("");
    setSegments([]);
    setFeedback(null);
    setLoading(true);

    // Upload to /api/transcribe
    const data = new FormData();
    data.append("audio", file);
    const resp = await fetch("/api/transcribe", { method: "POST", body: data });
    const result = await resp.json();
    if (result.error) alert(result.error);
    setTranscript(result.transcript);
    setSegments(result.segments);
    setLoading(false);
  }

  async function fetchFeedback() {
    setFeedback(null);
    setLoading(true);
    const resp = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const fb = await resp.json();
    if (fb.error) alert(fb.error);
    setFeedback(fb);
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-6 font-sans">
      <h1 className="text-2xl font-bold mb-2">Conversational Feedback Demo</h1>
      <PromptBox prompt={promptObj.prompt} onNextPrompt={nextPrompt} />
      <AudioRecorder onAudio={handleAudio} />
      {loading && <div className="text-blue-500 my-2">Processing...</div>}
      {segments.length > 0 && (
        <TranscriptHighlighter segments={segments} tips={feedback?.tips ?? []} />
      )}
      {transcript && !feedback && (
        <button className="my-2 px-4 py-2 bg-blue-600 text-white rounded" onClick={fetchFeedback}>
          Score & Feedback
        </button>
      )}
      {feedback && (
        <FeedbackPanel scores={feedback.scores} tips={feedback.tips} onRetry={nextPrompt} />
      )}
      <div className="mt-10 text-xs text-gray-400">Powered by Whisper + GPT-4. For demo.</div>
    </div>
  );
}