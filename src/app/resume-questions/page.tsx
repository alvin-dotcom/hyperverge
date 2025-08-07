"use client";
import { useState } from "react";

export default function ResumeQuestionsPage() {
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileName(f.name);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setQuestions(null);
    if (!!file) {
      // multipart for resume+topic
      const form = new FormData();
      if (topic.trim()) form.append("topic", topic);
      form.append("file", file);
      const resp = await fetch("/api/generate-questions", {
        method: "POST",
        body: form,
      });
      const result = await resp.json();
      setLoading(false);
      if (result.error) setError(result.error);
      else setQuestions(result.questions || []);
    } else if (topic.trim()) {
      // topic only
      const resp = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const result = await resp.json();
      setLoading(false);
      if (result.error) setError(result.error);
      else setQuestions(result.questions || []);
    } else {
      setLoading(false);
      setError("Please enter a topic or upload a resume.");
    }
  };

  const resetAll = () => {
    setTopic("");
    setFile(null);
    setFileName(null);
    setError(null);
    setQuestions(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-900 py-10 px-2 flex flex-col items-center transition-colors">
      <div className="w-full flex flex-col lg:flex-row gap-8 max-w-5xl transition-all">
        {/* Left: resume/topic box */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 p-6 sm:p-8 w-full max-w-xl flex flex-col transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✨</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Personalize Your Interview</span>
          </div>
          <div className="mb-2 text-gray-600 dark:text-zinc-300">
            <span>Select one or provide both: </span>
            <ul className="list-disc pl-6 text-sm mt-1 text-gray-500 dark:text-zinc-400">
              <li>Upload your <b>Resume</b> (<span className="font-mono">.pdf</span>, <span className="font-mono">.docx</span>, <span className="font-mono">.txt</span>) for deep question analysis</li>
              <li>Or type a <b>Topic/Role/Skill</b> (e.g., "React", "System Design", "Data Science", "Team Management", etc)</li>
            </ul>
          </div>
          <div className="my-4">
            <label className="block font-medium text-gray-800 dark:text-zinc-200 mb-1">
              Resume <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="block file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-zinc-700 dark:file:text-zinc-100 dark:file:hover:bg-zinc-600 transition"
              onChange={handleFileChange}
              disabled={loading}
            />
            {fileName && <span className="text-xs text-gray-600 dark:text-zinc-300">{fileName}</span>}
          </div>
          <div className="mb-4">
            <label className="block font-medium text-gray-800 dark:text-zinc-200 mb-1">
              Topic/Preference <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="E.g. Frontend, React, Leadership, Data Structures, AI, or paste your own job description..."
              className="w-full rounded border border-gray-300 dark:border-zinc-600 px-3 py-2 bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 dark:focus:ring-blue-500 transition resize-none"
              disabled={loading}
            />
          </div>
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-lg py-2 rounded font-semibold shadow disabled:opacity-50 transition"
            disabled={loading}
          >
            {loading ? "Generating..." : "Start Practicing"}
          </button>
          {(error || questions) && (
            <button
              onClick={resetAll}
              className="text-gray-400 dark:text-zinc-400 hover:underline text-xs mt-3"
              disabled={loading}
            >
              Reset
            </button>
          )}
          {error && (
            <div className="mt-4 text-red-600 dark:text-red-400 text-sm text-center">{error}</div>
          )}
          {questions && (
            <div className="mt-6">
              <div className="font-semibold mb-2 text-lg text-gray-800 dark:text-zinc-100">
                {file ? <>Resume-based</> : topic ? <>Topic-based</> : null} Interview Questions
              </div>
              <ol className="space-y-2 pl-6 list-decimal text-gray-700 dark:text-zinc-200">
                {questions.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </div>
          )}
        </div>
        {/* Right: Quick Practice */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 p-6 sm:p-8 w-full max-w-xl flex flex-col items-center justify-center transition-colors">
          <div className="text-2xl font-bold mb-2 text-gray-900 dark:text-white text-center">
            Practice a Random Question
          </div>
          <div className="text-gray-500 dark:text-zinc-400 mb-6 text-center text-base">
            Don&apos;t have a resume or preferred topic?<br /> Try out a random interview question instantly!
          </div>
          <a
            href="/speech-feedback"
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-8 py-3 rounded text-lg font-medium shadow transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/60"
            tabIndex={0}
          >
            Start Practicing Now
          </a>
        </div>
      </div>
    </div>
  );
}