'use client'

// import { Dialog, TabsContent, TabsList, TabsTrigger, Tabs } from '@/components/ui'; 
import { Dialog } from '@radix-ui/react-dialog';
import { TabsContent } from '@radix-ui/react-tabs';
import { TabsList} from '@radix-ui/react-tabs';
 import { TabsTrigger } from '@radix-ui/react-tabs';
    import { Tabs } from '@radix-ui/react-tabs';
// Make sure these exist
import { Upload } from 'lucide-react';
import { useState, useRef } from 'react';
import { pdfjs } from 'react-pdf';

// Configure PDF.js worker
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (error) {
    console.warn('Could not set PDF worker source:', error);
  }
}

interface GenerateWithAIDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: GenerationConfig) => Promise<void>;
  isGenerating?: boolean;
}

interface GenerationConfig {
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  numSections?: number;
  numQuestions: {
    mcq: number;
    saq: number;
  };
  referencePdf?: File;
  additionalInstructions?: string;
}

export default function GenerateWithAIDialog({
  open,
  onClose,
  onSubmit,
  isGenerating,
}: GenerateWithAIDialogProps) {
  const [activeTab, setActiveTab] = useState('topic');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<GenerationConfig>({
    topic: '',
    difficulty: 'intermediate',
    numSections: 4,
    numQuestions: { mcq: 10, saq: 3 },
  });

  const handleSubmit = async () => {
    try {
      await onSubmit(config);
    } catch (error) {
      console.error('Generation error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#1A1A1A] rounded-lg shadow-xl w-full max-w-2xl">
          <div className="p-6 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Generate Course with AI</h2>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 gap-4 bg-[#111]">
                <TabsTrigger value="topic">Topic</TabsTrigger>
                <TabsTrigger value="structure">Structure</TabsTrigger>
                <TabsTrigger value="reference">Reference</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
              </TabsList>

              <TabsContent value="topic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Course Topic</label>
                  <input
                    type="text"
                    value={config.topic}
                    onChange={(e) => setConfig({ ...config, topic: e.target.value })}
                    className="w-full bg-[#111] border border-gray-700 rounded-lg p-3"
                    placeholder="e.g. Hash Tables, React Hooks"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Difficulty Level</label>
                  <select
                    value={config.difficulty}
                    onChange={(e) =>
                      setConfig({ ...config, difficulty: e.target.value as any })
                    }
                    className="w-full bg-[#111] border border-gray-700 rounded-lg p-3"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </TabsContent>

              <TabsContent value="structure" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Number of Sections</label>
                    <input
                      type="number"
                      value={config.numSections}
                      onChange={(e) =>
                        setConfig({ ...config, numSections: parseInt(e.target.value) })
                      }
                      className="w-full bg-[#111] border border-gray-700 rounded-lg p-3"
                      min={1}
                      max={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">Questions</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={config.numQuestions.mcq}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            numQuestions: {
                              ...config.numQuestions,
                              mcq: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full bg-[#111] border border-gray-700 rounded-lg p-3"
                        placeholder="MCQs"
                      />
                      <input
                        type="number"
                        value={config.numQuestions.saq}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            numQuestions: {
                              ...config.numQuestions,
                              saq: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full bg-[#111] border border-gray-700 rounded-lg p-3"
                        placeholder="SAQs"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="reference" className="space-y-4 mt-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-400">Upload a PDF reference document</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) =>
                    setConfig({ ...config, referencePdf: e.target.files?.[0] })
                  }
                  className="hidden"
                />
                <textarea
                  value={config.additionalInstructions}
                  onChange={(e) =>
                    setConfig({ ...config, additionalInstructions: e.target.value })
                  }
                  className="w-full bg-[#111] border border-gray-700 rounded-lg p-3 h-32"
                  placeholder="Additional instructions for AI..."
                />
              </TabsContent>

              <TabsContent value="review" className="space-y-4 mt-4">
                <div className="bg-[#111] rounded-lg p-4">
                  <h3 className="font-medium mb-2">Generation Config Summary</h3>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li>Topic: {config.topic}</li>
                    <li>Difficulty: {config.difficulty}</li>
                    <li>Sections: {config.numSections}</li>
                    <li>
                      Questions: {config.numQuestions.mcq} MCQs, {config.numQuestions.saq} SAQs
                    </li>
                    <li>Reference: {config.referencePdf?.name || 'None'}</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!config.topic || isGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate Course'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
