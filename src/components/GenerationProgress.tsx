import { useEffect, useState } from 'react';

interface GenerationProgressProps {
  messages: string[];
  isComplete: boolean;
}

export default function GenerationProgress({ messages, isComplete }: GenerationProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (messages.length > 0) {
      const percentage = (messages.length / 10) * 100;
      setProgress(Math.min(percentage, 100));
    }
  }, [messages]);

  return (
    <div className="fixed bottom-8 right-8 bg-[#1A1A1A] rounded-lg shadow-xl p-6 w-96 z-50">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-medium">Generating Course</h3>
          <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
        </div>
        
        <div className="h-2 bg-[#111] rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {messages.map((msg, i) => (
            <p key={i} className="text-sm text-gray-400">{msg}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
