"use client";
import { useEffect, useRef, useState } from "react";
import { saveInterviewSession } from "@/lib/utils/db";


// 🔴 Azure OpenAI details
const AZURE_OPENAI_API_KEY = "YOUR_API_KEY";
const AZURE_DEPLOYMENT = "gpt-4.1";
const AZURE_API_VERSION = "2024-02-15-preview";
const AZURE_ENDPOINT = `YOUR_DOMAIN.COM/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;

// 🔴 Azure Speech-to-Text details
const AZURE_SPEECH_KEY = "YOUR_API_KEY";
const AZURE_SPEECH_REGION = "eastus2";
const AZURE_SPEECH_ENDPOINT = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

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
// 1. Azure Speech-to-Text Function
async function transcribeAudioWithAzure(audioBlob: Blob): Promise<string> {
  try {
    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();
    
    const response = await fetch(AZURE_SPEECH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'audio/wav', // or 'audio/webm' depending on your recording format
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      throw new Error(`Azure Speech API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Azure Speech-to-Text response structure
    if (result.RecognitionStatus === 'Success') {
      return result.DisplayText || '';
    } else {
      console.warn('Speech recognition failed:', result.RecognitionStatus);
      return '';
    }
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return '';
  }
}

// --------------------
// 2. Convert WebM to WAV (Azure prefers WAV format)
function convertWebMToWAV(webmBlob: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Convert to WAV
        const wavBuffer = audioBufferToWav(audioBuffer);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        resolve(wavBlob);
      } catch (error) {
        console.error('Error converting audio:', error);
        resolve(webmBlob); // Fallback to original blob
      }
    };
    reader.readAsArrayBuffer(webmBlob);
  });
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length;
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numberOfChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * numberOfChannels * 2, true);
  
  // Convert audio data
  let offset = 44;
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return arrayBuffer;
}

// --------------------
// 3. LLM Evaluation API Call
async function evalAnswer(question: string, transcript: string, apiKey: string): Promise<Feedback | null> {
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
// 4. Main Interview Page
export default function SpeechFeedbackPractice() {
  const [questions, setQuestions] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  const [cameraStatus, setCameraStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [timer, setTimer] = useState(60);
  const [isRecording, setIsRecording] = useState(false);
  const [hasStopped, setHasStopped] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

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

  // --- Start recording ---
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
        recorder.onstop = async () => {
          const webmBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          
          // Save the audio blob
          setAnswers(prev => prev.map((a, i) => i === index ? { ...a, audio: webmBlob } : a));
          
          // Start transcription with Azure Speech-to-Text
          setIsTranscribing(true);
          try {
            // Convert to WAV format for better Azure compatibility
            const wavBlob = await convertWebMToWAV(webmBlob);
            const transcript = await transcribeAudioWithAzure(wavBlob);
            
            setAnswers(prev => prev.map((a, i) => i === index ? { ...a, transcript } : a));
          } catch (error) {
            console.error('Transcription failed:', error);
            setAnswers(prev => prev.map((a, i) => i === index ? { ...a, transcript: "Transcription failed" } : a));
          } finally {
            setIsTranscribing(false);
          }
        };
        recorder.start();
      } catch {
        alert("Unable to start audio recorder.");
        setIsRecording(false);
      }
    }
  }

  function handleStopClick() {
    setIsRecording(false);
    setHasStopped(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
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
    console.log("🔵 Finish button clicked");
    stopCameraAndMic();
    setIsEvaluating(true);

    const results: (Feedback | null)[] = [];

    for (let i = 0; i < answers.length; ++i) {
      const ans = answers[i];
      console.log(`🟡 Q${i + 1}: ${ans.question}`);
      console.log(`🟢 Transcript: ${ans.transcript}`);
      
      if (!ans.transcript) {
        console.warn(`⚠️ No transcript for Q${i + 1}`);
        results.push(null);
        continue;
      }

      const feedback = await evalAnswer(ans.question, ans.transcript, AZURE_OPENAI_API_KEY);
      console.log(`✅ Feedback received for Q${i + 1}`, feedback);
      results.push(feedback);
    }

    setFeedbackArr(results);
    setIsEvaluating(false);

    console.log("💾 Saving session to DB...");
    await saveInterviewSession(
      answers.map(a => a.question),
      answers.map(a => a.audio || new Blob()),
      answers.map(a => a.transcript || ""),
      results
    );

    setSavedAt(Date.now());
    console.log("✅ Session saved.");
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
  <div className="min-h-screen bg-black from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex justify-center items-center transition-all duration-300 p-4">
    {
      // Define the completion condition:
      (index === questions.length - 1 && feedbackArr.some(f => f !== null))
      ? (
      // === FEEDBACK TABLE ONLY ===
      <div className="bg-white dark:bg-[#1B202B] rounded-3xl dark:shadow-gray-900/20 w-full max-w-[90vw] h-full max-h-[90vh] flex flex-col overflow-hidden p-6 sm:p-10 transition-all duration-300">
        <div className="w-full mt-6 space-y-6 overflow-y-auto">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">Interview Complete</h2>
            <p className="text-gray-600 dark:text-gray-300">Here's your detailed feedback and performance analysis</p>
          </div>
          <div className="text-white bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-600 overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-600">
                  <th className="p-3">#</th>
                  <th className="p-3">Content</th>
                  <th className="p-3">Structure</th>
                  <th className="p-3">Clarity</th>
                  <th className="p-3">Delivery</th>
                  <th className="p-3">Improvement Tips</th>
                </tr>
              </thead>
              <tbody>
                {answers.map((ans, i) => (
                  <tr key={i} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600/30 transition-colors">
                    <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{i + 1}</td>
                    <td className="p-3">{feedbackArr[i]?.content ?? "-"}</td>
                    <td className="p-3">{feedbackArr[i]?.structure ?? "-"}</td>
                    <td className="p-3">{feedbackArr[i]?.clarity ?? "-"}</td>
                    <td className="p-3">{feedbackArr[i]?.delivery ?? "-"}</td>
                    <td className="p-3">
                      {(feedbackArr[i]?.tips || []).map((t, j) => (
                        <div key={j} className="mb-2 last:mb-0">
                          <div className="font-medium text-gray-800 dark:text-gray-200">• {t.tip}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 ml-3">"{t.snippet}"</div>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <button
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 sm:px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-semibold flex items-center gap-3"
              onClick={handleDownloadFeedback}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Feedback Report
            </button>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Results saved</span>
            </div>
          </div>
        </div>
      </div>
      )
      :
      (
      // === ALL INTERVIEW_UI AS BEFORE ===
      <div className="bg-white dark:bg-[#1B202B] rounded-3xl  dark:shadow-gray-900/20
                      w-full max-w-[90vw] h-full max-h-[90vh] flex flex-col overflow-hidden p-6 sm:p-10 transition-all duration-300">
        {/* Header Section */}
        <div className="text-center mb-6 flex-shrink-0">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Interview Question {questions.length > 1 && `${index + 1} of ${questions.length}`}
          </div>
          <h1 className="text-xl sm:text-3xl lg:text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2 break-words">
            {questions[index]}
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mx-auto"></div>
        </div>
        {/* Main Content */}
        <div className="flex flex-col items-center space-y-6 flex-grow overflow-y-auto">
          {/* Camera Preview */}
          <div className="relative w-full max-w-xs aspect-video">
            <video
              ref={videoRef}
              className="rounded-2xl border-2 border-gray-200 dark:border-gray-600 bg-black shadow-lg transition-all duration-300 w-full h-full object-cover"
              autoPlay
              muted
              playsInline
              style={{
                display: cameraStatus === "granted" ? "block" : "none"
              }}
            />
            {cameraStatus !== "granted" && (
              <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-500">
                <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-500 dark:text-gray-400 font-medium">Camera Preview</span>
              </div>
            )}
            {/* Recording Indicator */}
            {/* {isRecording && (
              <div className="absolute -top-2 -right-2 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                REC
              </div>
            )} */}
          </div>
          {/* Recording Controls */}
          <div className="flex flex-col items-center space-y-4">
            {!isRecording && !hasStopped && (
              <button
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                            text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 
                            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none 
                            font-semibold text-base sm:text-lg"
                disabled={isRecording || isEvaluating}
                onClick={handleRecordClick}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  Start Recording
                </div>
              </button>
            )}
            {isRecording && (
              <button
                className="group relative overflow-hidden bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 
                            text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 
                            transition-all duration-200 font-semibold text-base sm:text-lg"
                onClick={handleStopClick}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-white rounded-sm"></div>
                  Stop Recording
                </div>
              </button>
            )}
          </div>
          {/* Timer and Progress */}
          <div className="w-full max-w-lg space-y-3">
            {/* <div className="text-center">
              <span className="text-xl sm:text-3xl font-mono font-bold text-gray-800 dark:text-gray-200 tracking-wider">
                {`${String(Math.floor(timer / 60)).padStart(1, "0")}:${String(timer % 60).padStart(2, "0")}`}
              </span>
            </div> */}
            <div className="relative">
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out relative"
                  style={{
                    width: `${(timer / 60) * 100}%`
                  }}
                >
                  <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                <span>0:00</span>
                <span>1:00</span>
              </div>
            </div>
          </div>
          {/* Status Messages */}
          {isTranscribing && (
            <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-6 py-3 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="font-medium">Submitting your answer...</span>
            </div>
          )}
          {/* Feedback Table (hidden until complete) */}
          {/* {(index === questions.length - 1 && feedbackArr.some(f => f !== null)) ? ...etc */}
          {isEvaluating ? (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Analyzing Your Performance</h3>
                <p className="text-gray-600 dark:text-gray-300">Our AI is evaluating your responses and preparing detailed feedback...</p>
              </div>
            </div>
          ) : (
            // Navigation Controls
            <div className="flex flex-col items-center space-y-4">
              {index === questions.length - 1 ? (
                <button
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-8 sm:px-12 py-3 sm:py-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none font-semibold text-lg flex items-center gap-3"
                  onClick={handleFinish}
                  disabled={!hasStopped || isEvaluating || isTranscribing}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Complete Interview
                </button>
              ) : (
                <button
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 sm:px-12 py-3 sm:py-4 rounded-2xl shadow-lg hover:shadow-xl transform transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none font-semibold text-lg flex items-center gap-3"
                  onClick={handleNext}
                  disabled={!hasStopped || isTranscribing}
                >
                  Next Question
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )
    }
  </div>
);
