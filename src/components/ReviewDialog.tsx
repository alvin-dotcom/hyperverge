import { Dialog } from '@radix-ui/react-dialog';
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  review: {
    suggestions: Array<{
      type: string;
      location: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    bloomCoverage: Record<string, number>;
    difficultyDistribution: Record<string, number>;
  };
}

export default function ReviewDialog({ open, onClose, review }: ReviewDialogProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#1A1A1A] rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto">
          <div className="p-6 space-y-6">
            <h2 className="text-2xl font-semibold text-white">Content Review</h2>

            <div className="space-y-6">
              {/* Suggestions */}
              <div>
                <h3 className="text-lg font-medium mb-4">Suggestions</h3>
                <div className="space-y-4">
                  {review.suggestions.map((suggestion, i) => (
                    <div key={i} className="bg-[#111] rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        <AlertCircle className={getSeverityColor(suggestion.severity)} />
                        <div>
                          <p className="font-medium">{suggestion.type}</p>
                          <p className="text-sm text-gray-400 mt-1">{suggestion.description}</p>
                          <p className="text-xs text-gray-500 mt-2">Location: {suggestion.location}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coverage Analysis */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Bloom's Taxonomy Coverage</h3>
                  <div className="space-y-2">
                    {Object.entries(review.bloomCoverage).map(([level, percentage]) => (
                      <div key={level} className="flex items-center gap-2">
                        <div className="w-32 text-sm">{level}</div>
                        <div className="flex-1 h-2 bg-[#111] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-12 text-sm text-right">{percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Difficulty Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(review.difficultyDistribution).map(([level, percentage]) => (
                      <div key={level} className="flex items-center gap-2">
                        <div className="w-32 text-sm">{level}</div>
                        <div className="flex-1 h-2 bg-[#111] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-12 text-sm text-right">{percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
