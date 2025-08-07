"use client";
import { useEffect, useRef, useState } from "react";
import { saveInterviewSession } from "@/lib/utils/db";

// 🔴 Fill with your actual OpenAI/Azure OpenAI details
const AZURE_OPENAI_API_KEY = "Your_API_KEY";      // Replace with your key or use env
const AZURE_DEPLOYMENT = "gpt-4.1";
const AZURE_API_VERSION = "2024-02-15-preview";
const AZURE_ENDPOINT =  `Your_DOMAIN.COM/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;

type Feedback = {
  content: number;
  structure: number;
  clarity: number;
  delivery: number;
  tips: { tip: string; snippet: string }[];
};

const DEFAULT_QUESTIONS = [
  "How do you handle disagreements within your team?",
  "Describe a challenging technical project you led.",
  "How do you keep your skills updated?",
  "What motivates you in your work?",
  "Tell me about a time you showed leadership.",
  "Explain a difficult bug you've fixed.",
  "How do you prioritize tasks?",
  "Describe your experience with remote collaboration.",
  "How do you deal with tight deadlines?",
  "What is your approach to learning new technologies?",
];

type QAEntry = {
  question: string;
  audio: Blob | null;
  transcript: string | null;
};

function getAllPracticeQuestionsFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const arr = JSON.parse(localStorage.getItem("practiceQuestions") ?? "null");
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return null;
}
function getSearchPracticeParam() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("practice");
}

// --------------------
// 1. Utility: LLM Evaluation API Call
async function evalAnswer(question: string, transcript: string, apiKey: string): Promise<Feedback | null> {
  // ---- SYSTEM PROMPT ----
  const prompt = `
You are an expert interviewer.
Below is a question and a transcribed answer.
Evaluate the answer on a 0-10 scale for:
- Content (addressing the question)
- Structure (logical flow, organization)
- Clarity (clear, concise communication)
- Delivery (vocal, engaging, confident)
Return valid JSON:
{
  "content": 8,
  "structure": 7,
  "clarity": 8,
  "delivery": 7,
  "tips": [
    { "tip": "Start with a summary sentence to frame your answer.", "snippet": "first sentence of your answer" },
    { "tip": "Be more specific about your role in the project.", "snippet": "I was involved in..." }
  ]
}
Question: ${question}
Answer transcript:
${transcript}
Evaluate and give tips based on transcript lines only. ONLY return JSON.
`.trim();

  const response = await fetch(AZURE_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 0,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
    }),
  });

  const data = await response.json();
  try {
    const text = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text.match(/{[\s\S]*}/)?.[0] ?? "{}");
    return parsed as Feedback;
  } catch {
    return null;
  }
}

// --------------------
// 2. Main Interview Page
export default function SpeechFeedbackPractice() {
  const [questions, setQuestions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  const [cameraStatus, setCameraStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [timer, setTimer] = useState(60);
  const [isRecording, setIsRecording] = useState(false);
  const [hasStopped, setHasStopped] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const [answers, setAnswers] = useState<QAEntry[]>([]);
  const [feedbackArr, setFeedbackArr] = useState<(Feedback | null)[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [savedAt, setSavedAt] = useState<number | null>(null);

  // For video/audio preview
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // For audio recording
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // For live transcription
  const recognitionRef = useRef<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Load questions/session ONCE
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isPractice = getSearchPracticeParam() === "1";
    let loaded: string[] | null = null;
    if (isPractice) loaded = getAllPracticeQuestionsFromStorage();
    if (!loaded) loaded = DEFAULT_QUESTIONS;
    setQuestions(loaded);
    setIndex(0);
    setAnswers(loaded.map(q => ({
      question: q,
      audio: null,
      transcript: null,
    })));
    setFeedbackArr(loaded.map(() => null));
  }, []);

  // --- Camera/audio ONCE
  useEffect(() => {
    async function getStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        setCameraStatus("granted");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play?.();
        }
      } catch {
        setCameraStatus("denied");
      }
    }
    getStream();
    return () => stopCameraAndMic();
    // eslint-disable-next-line
  }, []);

  function stopCameraAndMic() {
    if (videoRef.current) videoRef.current.srcObject = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  // --- Start recording & transcription ---
  function handleRecordClick() {
    setIsRecording(true);
    setHasStopped(false);
    setTimer(60);
    chunksRef.current = [];

    // Start MediaRecorder
    const stream = streamRef.current;
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        alert("No audio track found!");
        setIsRecording(false);
        return;
      }
      const audioStream = new MediaStream();
      audioTracks.forEach(t => audioStream.addTrack(t));
      try {
        const recorder = new MediaRecorder(audioStream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          setAnswers(prev => prev.map((a, i) => i === index ? { ...a, audio: blob } : a));
        };
        recorder.start();
      } catch {
        alert("Unable to start audio recorder.");
        setIsRecording(false);
      }
    }

    // Start live SpeechRecognition (for transcript while recording)
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) throw new Error("SpeechRecognition not supported in this browser.");
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognitionRef.current = recognition;
      setTranscribing(true);

      let finalTranscript = '';
      recognition.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          finalTranscript += event.results[0][0].transcript + " ";
        }
      };
      recognition.onerror = (event: any) => {
        setTranscribing(false);
      };
      recognition.onend = () => {
        setAnswers(prev => prev.map((a, i) => i === index ? { ...a, transcript: finalTranscript } : a));
        setTranscribing(false);
      };
      recognition.start();
    } catch (err) {
      setTranscribing(false);
    }
  }

  function handleStopClick() {
    setIsRecording(false);
    setHasStopped(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    try {
      recognitionRef.current && recognitionRef.current.stop();
    } catch {}
  }

  function handleNext() {
    setHasStopped(false);
    setIsRecording(false);
    setTimer(60);
    if (index + 1 < questions.length) {
      setIndex((idx) => idx + 1);
    }
  }

  // --- FINISH/EVALUATE ---
  async function handleFinish() {
    stopCameraAndMic();
    setIsEvaluating(true);
    const results: (Feedback | null)[] = [];
    for (let i = 0; i < answers.length; ++i) {
      const ans = answers[i];
      if (!ans.transcript) {
        results.push(null);
        continue;
      }
      // 🔴 Use your real API KEY in prod!
      const feedback = await evalAnswer(ans.question, ans.transcript, AZURE_OPENAI_API_KEY);
      results.push(feedback);
    }
    setFeedbackArr(results);
    setIsEvaluating(false);
    // Save all data (including feedback) in DB
    await saveInterviewSession(
      answers.map(a => a.question),
      answers.map(a => a.audio || new Blob()),
      answers.map(a => a.transcript || ""),
      results
    );
    setSavedAt(Date.now());
  }

  // --- Download feedback as .txt
  function handleDownloadFeedback() {
    let txt = "";
    answers.forEach((ans, i) => {
      const f = feedbackArr[i] || {};
      txt += `Q${i + 1}: ${ans.question}\n`;
      txt += `Your Answer: ${ans.transcript}\n`;
      txt += `Scores: Content=${f.content ?? ""}/10, Structure=${f.structure ?? ""}/10, Clarity=${f.clarity ?? ""}/10, Delivery=${f.delivery ?? ""}/10\n`;
      txt += "Tips:\n";
      (f.tips || []).forEach((t: any) => {
        txt += `- ${t.tip} (eg: "${t.snippet}")\n`;
      });
      txt += "\n";
    });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    element.download = "interview_feedback.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  // --- Timer logic
  useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimer(60);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          setIsRecording(false);
          setHasStopped(true);
          if (recorderRef.current && recorderRef.current.state === "recording") {
            recorderRef.current.stop();
          }
          try {
            recognitionRef.current && recognitionRef.current.stop();
          } catch {}
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-900 pt-8 sm:pt-14 flex justify-center items-center transition-colors">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-700 p-6 sm:p-10 w-full max-w-2xl mx-4 transition-colors">
        <div className="text-center text-gray-500 dark:text-zinc-400 text-md mb-2 font-medium tracking-wide">
          Interview Question {questions.length > 1 && `(${index + 1} / ${questions.length})`}
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8 text-gray-900 dark:text-white min-h-[48px]">
          {questions[index]}
        </h2>
        <div className="flex flex-col items-center">
          <div className="mb-2">
            <video
              ref={videoRef}
              width={180}
              height={130}
              className="rounded-lg border border-gray-300 dark:border-zinc-600 bg-black"
              autoPlay
              muted
              playsInline
              style={{
                display: cameraStatus === "granted" ? "block" : "none"
              }}
            />
            {cameraStatus !== "granted" && (
              <div className="w-[180px] h-[130px] flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-400">Camera Preview</div>
            )}
          </div>
          {!isRecording && !hasStopped && (
            <button
              className={`
                w-28 h-14 bg-blue-600 hover:bg-blue-700 text-white
                rounded-lg shadow font-semibold mb-4 transition
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              disabled={isRecording || isEvaluating}
              onClick={handleRecordClick}
            >
              Start Recording
            </button>
          )}
          {isRecording && (
            <button
              className={`
                w-28 h-14 bg-red-600 hover:bg-red-700 text-white
                rounded-lg shadow font-semibold mb-4 transition
              `}
              onClick={handleStopClick}
            >
              Stop
            </button>
          )}
          <div className="flex flex-col items-center gap-2">
            <span className="tracking-wide font-mono text-lg text-gray-700 dark:text-zinc-200">
              {`${String(Math.floor(timer / 60)).padStart(1, "0")}:${String(timer % 60).padStart(2, "0")}`}
            </span>
            <div className="w-full h-3 bg-gray-200 dark:bg-zinc-700 rounded-lg mt-1 overflow-hidden mb-1">
              <div
                className="h-3 bg-blue-400 dark:bg-blue-600 transition-all"
                style={{
                  width: `${(timer / 60) * 100}%`
                }}
              />
            </div>
          </div>
          {transcribing && (
            <div className="mt-3 text-blue-500 text-sm">Transcribing...</div>
          )}
          {(index === questions.length - 1 && feedbackArr.some(f => f !== null)) ? (
            <div className="mt-6 w-full">
              <h2 className="text-xl font-bold mb-4 text-blue-800 dark:text-blue-300">Interview Feedback</h2>
              <table className="w-full text-left text-sm mb-4 border-collapse">
                <thead>
                  <tr>
                    <th className="border-b p-1 pr-2">#</th>
                    <th className="border-b p-1 pr-2">Content</th>
                    <th className="border-b p-1 pr-2">Structure</th>
                    <th className="border-b p-1 pr-2">Clarity</th>
                    <th className="border-b p-1 pr-2">Delivery</th>
                    <th className="border-b p-1 pr-2">Tips</th>
                  </tr>
                </thead>
                <tbody>
                  {answers.map((ans, i) => (
                    <tr key={i}>
                      <td className="border-b p-1 pr-2 font-bold">{i + 1}</td>
                      <td className="border-b p-1 pr-2">{feedbackArr[i]?.content ?? "-"}</td>
                      <td className="border-b p-1 pr-2">{feedbackArr[i]?.structure ?? "-"}</td>
                      <td className="border-b p-1 pr-2">{feedbackArr[i]?.clarity ?? "-"}</td>
                      <td className="border-b p-1 pr-2">{feedbackArr[i]?.delivery ?? "-"}</td>
                      <td className="border-b p-1 pr-2">{(feedbackArr[i]?.tips || []).map((t, j) => <div key={j}>- {t.tip} <span className="text-xs text-gray-400">({t.snippet})</span></div>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded shadow"
                onClick={handleDownloadFeedback}
              >
                Download Feedback
              </button>
              <div className="text-green-600 text-center mt-3">Your results are saved locally.</div>
            </div>
          ) : isEvaluating ? (
              <div className="text-center text-lg text-blue-600 animate-pulse mt-8">
                Evaluating your answers... (this may take a few seconds)
              </div>
          ) : (
            // Interview in progress
            <>
              {index === questions.length - 1 ? (
                <button
                  className="mt-8 bg-blue-700 hover:bg-blue-800 text-white px-8 py-2 rounded text-lg font-medium shadow transition disabled:opacity-60"
                  onClick={handleFinish}
                  disabled={!hasStopped || isEvaluating}
                >
                  Finish
                </button>
              ) : (
                <button
                  className="mt-8 bg-blue-700 hover:bg-blue-800 text-white px-8 py-2 rounded text-lg font-medium shadow transition disabled:opacity-60"
                  onClick={handleNext}
                  disabled={!hasStopped}
                >
                  Next
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
