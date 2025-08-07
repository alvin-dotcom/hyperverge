"use client";
import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import * as mammoth from "mammoth";

// ⚠️ Move keys to env variables in real apps!
const AZURE_OPENAI_API_KEY = "YOUR_API_KEY";
const AZURE_DEPLOYMENT = "gpt-4.1";
const AZURE_API_VERSION = "2024-02-15-preview";
const AZURE_ENDPOINT = `YOUR_DOMAIN.COMopenai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;


export default function ResumeQuestionsPage() {
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Lock topic if file uploaded and vice versa, as before
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFileName(selected.name);
      setTopic("");
    }
  };
  const handleTopicChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTopic(e.target.value);
    if (e.target.value.trim().length > 0) {
      setFile(null);
      setFileName(null);
    }
  };

  async function readFileText(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text = (content.items as any[]).map((item) => item.str).join(" ");
        fullText += text + "\n";
      }
      return fullText;
    }
    if (ext === "docx") {
      const arrayBuffer = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      return value;
    }
    if (ext === "txt") {
      return await file.text();
    }
    throw new Error("Unsupported file type.");
  }

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    let context = "";
    try {
      if (file) {
        const extractedText = await readFileText(file);
        if (!extractedText || extractedText.trim().length < 20)
          throw new Error("Could not extract usable text from file.");
        context += `Resume content:\n${extractedText}\n`;
      }
      if (topic.trim()) {
        context += `Interview for topic/role: "${topic}"\n`;
      }
      if (!context) {
        setError("Please upload a resume or enter a topic.");
        setLoading(false);
        return;
      }
      const prompt = `No sure and nothing formal only question, no * nothing , You are an expert interview coach. Based on the following context, generate a list of 10 relevant interview questions:\n${context}`;
      const response = await fetch(AZURE_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": AZURE_OPENAI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          max_tokens: 512,
          temperature: 1.0,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || "";
      const qs = content
        .split(/\n/)
        .map((l: string) => l.replace(/^(\d+[\.\)]|[-*])\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 10);

      if (!qs.length) throw new Error("Failed to extract interview questions.");

      // Store in localStorage for next page
      localStorage.setItem("practiceQuestions", JSON.stringify(qs));
      // Navigate to speech-feedback with flag. Use router if available, fallback to window.location
      if (typeof window !== "undefined") {
        window.location.href = "/speech-feedback?practice=1";
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setTopic("");
    setFile(null);
    setFileName(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-900 py-10 px-2 flex flex-col items-center transition-colors">
      <div className="w-full flex flex-col lg:flex-row gap-8 max-w-5xl transition-all">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 p-6 sm:p-8 w-full max-w-xl flex flex-col transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">✨</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Personalize Your Interview</span>
          </div>
          <div className="mb-2 text-gray-600 dark:text-zinc-300">
            <span>Select one or provide both: </span>
            <ul className="list-disc pl-6 text-sm mt-1 text-gray-500 dark:text-zinc-400">
              <li>Upload your <b>Resume</b> (<span className="font-mono">.pdf</span>, <span className="font-mono">.docx</span>, <span className="font-mono">.txt</span>)</li>
              <li>Or type a <b>Topic/Role/Skill</b></li>
            </ul>
          </div>
          <div className="my-4">
            <label className="block font-medium text-gray-800 dark:text-zinc-200 mb-1">Resume <span className="text-xs text-gray-400">(optional)</span></label>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="block file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-zinc-700 dark:file:text-zinc-100 dark:file:hover:bg-zinc-600 transition"
              onChange={handleFileChange}
              disabled={loading || topic.trim().length > 0}
            />
            {fileName && <span className="text-xs text-gray-600 dark:text-zinc-300">{fileName}</span>}
          </div>
          <div className="mb-4">
            <label className="block font-medium text-gray-800 dark:text-zinc-200 mb-1">Topic/Preference <span className="text-xs text-gray-400">(optional)</span></label>
            <textarea
              rows={3}
              value={topic}
              onChange={handleTopicChange}
              placeholder="E.g. Frontend, React, Leadership, etc"
              className="w-full rounded border border-gray-300 dark:border-zinc-600 px-3 py-2 bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 dark:focus:ring-blue-500 transition resize-none"
              disabled={loading || !!file}
            />
          </div>
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-lg py-2 rounded font-semibold shadow disabled:opacity-50 transition"
            disabled={loading}
          >
            {loading ? "Generating..." : "Start Interview"}
          </button>
          {(error) && (
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
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 p-6 sm:p-8 w-full max-w-xl flex flex-col items-center justify-center transition-colors">
          <div className="text-2xl font-bold mb-2 text-gray-900 dark:text-white text-center">Practice a Random Question</div>
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
