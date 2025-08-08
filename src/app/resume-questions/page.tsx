"use client";
import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf";
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import * as mammoth from "mammoth";
import Link from "next/link";
import Image from "next/image";

// ⚠️ Move keys to env variables in real apps!
const AZURE_OPENAI_API_KEY = "YOUR_API_KEY";
const AZURE_DEPLOYMENT = "gpt-4.1";
const AZURE_API_VERSION = "2024-02-15-preview";
const AZURE_ENDPOINT = `YOUR_DOMAIN.COM/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;


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
        window.location.href = "/interview?practice=1";
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
  <div className="min-h-screen bg-black dark:bg-black flex flex-col transition-colors">
    
    {/* Navbar */}
    <header className="w-full bg-black text-white shadow-lg">
  <div className="flex justify-between items-center px-4 sm:px-6 py-4">
    
    {/* Logo (flush left) */}
    <Link href="/" className="cursor-pointer flex items-center">
      <Image
        src="/images/sensai-logo.svg"
        alt="SensAI Logo"
        width={120}
        height={40}
        className="w-[90px] sm:w-[100px] md:w-[120px] h-auto"
        priority
      />
    </Link>

  </div>
</header>

    {/* Main Content */}
    <main className="flex-grow py-8 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full flex flex-col lg:flex-row gap-8 max-w-5xl">

        {/* Personalize Section */}
        <div className="bg-white dark:bg-[#1B202B] rounded-2xl p-6 sm:p-8 w-full flex flex-col transition-colors shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl sm:text-3xl">✨</span>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Personalize Your Interview
            </h2>
          </div>

          <p className="text-gray-600 dark:text-gray-200 mb-4 leading-relaxed text-sm sm:text-base">
            Select one or provide both:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm text-gray-500 dark:text-gray-300 space-y-1 mb-6">
            <li>
              Upload your <b>Resume</b> (<code>.pdf</code>, <code>.docx</code>, <code>.txt</code>)
            </li>
            <li>
              Or type a <b>Topic / Role / Skill</b>
            </li>
          </ul>

          {/* Resume Upload */}
          <div className="mb-6">
            <label className="block font-medium text-gray-800 dark:text-gray-100 mb-2 text-sm sm:text-base">
              Resume <span className="text-xs text-gray-400"></span>
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="block w-full file:mr-3 sm:file:mr-4 file:py-1 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-zinc-700 dark:file:text-white transition"
              onChange={handleFileChange}
              disabled={loading || topic.trim().length > 0}
            />
            {fileName && <span className="text-xs text-gray-200 dark:text-gray-300 mt-2 block truncate">{fileName}</span>}
          </div>

          {/* Topic Input */}
          <div className="mb-6">
            <label className="block font-medium text-gray-800 dark:text-gray-100 mb-2 text-sm sm:text-base">
              Topic / Preference <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={handleTopicChange}
              placeholder="E.g. Frontend, React, Leadership, etc"
              className="w-full rounded-lg border border-gray-300 dark:border-zinc-600 px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-zinc-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition resize-none text-sm sm:text-base"
              disabled={loading || !!file}
            />
          </div>

          {/* Buttons */}
          <button
            onClick={handleSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm sm:text-lg py-2 sm:py-3 rounded-lg font-semibold shadow-lg disabled:opacity-50 transition"
            disabled={loading}
          >
            {loading ? "Generating..." : "Start Interview"}
          </button>

          {error && (
            <>
              <button
                onClick={resetAll}
                className="text-gray-400 dark:text-gray-400 hover:underline text-xs mt-4"
                disabled={loading}
              >
                Reset
              </button>
              <div className="mt-3 text-red-600 dark:text-red-400 text-sm text-center">{error}</div>
            </>
          )}
        </div>

        {/* Random Question Section */}
        <div className="bg-white dark:bg-[#1B202B] rounded-2xl p-6 sm:p-8 w-full flex flex-col items-center justify-center transition-colors shadow-lg text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 text-gray-900 dark:text-white">
            Practice a Random Question
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm sm:text-base leading-relaxed">
            Don&apos;t have a resume or preferred topic? <br />
            Try out a random interview question instantly!
          </p>
          <a
            href="/interview"
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-lg text-sm sm:text-lg font-medium shadow-lg transition focus:outline-none focus:ring-4 focus:ring-blue-400/60"
          >
            Start Practicing Now
          </a>
        </div>
      </div>
    </main>
  </div>
);
