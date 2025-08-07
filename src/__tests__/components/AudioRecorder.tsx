'use client'
import React, { useRef, useState } from "react";

type Props = {
  onAudio: (file: File) => void;
};

export function AudioRecorder({ onAudio }: Props) {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    setAudioUrl(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new window.MediaRecorder(stream);
    audioChunks.current = [];
    recorder.ondataavailable = (e: any) => audioChunks.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(audioChunks.current, { type: "audio/wav" });
      const file = new File([blob], "recording.wav");
      setAudioUrl(URL.createObjectURL(blob));
      onAudio(file);
      audioChunks.current = [];
      stream.getTracks().forEach(track => track.stop());
    };
    setMediaRecorder(recorder);
    setRecording(true);
    recorder.start();
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioUrl(URL.createObjectURL(file));
      onAudio(file);
    }
  };

  return (
    <div className="mb-4">
      <button
        className={`px-4 py-2 rounded mr-2 ${
          recording ? "bg-red-600 text-white" : "bg-blue-600 text-white"
        }`}
        onClick={recording ? stopRecording : startRecording}
      >
        {recording ? "Stop" : "Record"}
      </button>
      <label className="cursor-pointer px-3 py-2 bg-gray-200 rounded">
        Upload
        <input
          type="file"
          accept="audio/*"
          hidden
          onChange={handleUpload}
        />
      </label>
      {audioUrl && (
        <audio controls className="block mt-2">
          <source src={audioUrl} />
        </audio>
      )}
    </div>
  );
}