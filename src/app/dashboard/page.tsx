"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { User, Mail, Calendar, Clock, Eye, Download, Star, TrendingUp, BarChart3, FileText, Filter, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// Types based on your feedback structure
type Feedback = {
  content: number;
  structure: number;
  clarity: number;
  delivery: number;
  tips: { tip: string; snippet: string }[];
};

const calculateAverageScore = (feedback: (Feedback | null)[]): number => {
  const validFeedback = feedback.filter(f => f !== null) as Feedback[];
  if (validFeedback.length === 0) return 0;
  
  const totalScore = validFeedback.reduce((sum, f) => {
    return sum + f.content + f.structure + f.clarity + f.delivery;
  }, 0);
  
  return Math.round((totalScore / (validFeedback.length * 4)) * 10) / 10;
};

type InterviewSession = {
  id: number;
  timestamp: number;
  questions: string[];
  answers: Blob[];
  transcripts: string[];
  feedback?: (Feedback | null)[];
  averageScore?: number;
  totalQuestions?: number;
};

// Database functions matching your structure
function openInterviewDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("InterviewPractice", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("answers")) {
        db.createObjectStore("answers", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Function to get all interview sessions from your database
const getInterviewSessions = async (): Promise<InterviewSession[]> => {
  try {
    const db = await openInterviewDB();
    const transaction = db.transaction(['answers'], 'readonly');
    const store = transaction.objectStore('answers');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const sessions = request.result.map((session: any) => ({
          ...session,
          averageScore: calculateAverageScore(session.feedback || []),
          totalQuestions: session.questions?.length || 0
        }));
        // Sort by timestamp (most recent first)
        sessions.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error fetching sessions from IndexedDB:', error);
    return [];
  }
};

// Analytics Modal Component
const AnalyticsModal = ({ sessions, onClose }: { sessions: InterviewSession[]; onClose: () => void }) => {
  const [dateRange, setDateRange] = useState({
    from: '',
    to: ''
  });
  const [filteredSessions, setFilteredSessions] = useState<InterviewSession[]>(sessions);

  // Initialize date range with earliest and latest sessions
  useEffect(() => {
    if (sessions.length > 0) {
      const timestamps = sessions.map(s => s.timestamp).sort((a, b) => a - b);
      const fromDate = new Date(timestamps[0]).toISOString().split('T')[0];
      const toDate = new Date(timestamps[timestamps.length - 1]).toISOString().split('T')[0];
      setDateRange({ from: fromDate, to: toDate });
    }
  }, [sessions]);

  // Filter sessions based on date range
  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      const fromTimestamp = new Date(dateRange.from).getTime();
      const toTimestamp = new Date(dateRange.to).setHours(23, 59, 59, 999);
      
      const filtered = sessions.filter(session => 
        session.timestamp >= fromTimestamp && session.timestamp <= toTimestamp
      );
      setFilteredSessions(filtered);
    } else {
      setFilteredSessions(sessions);
    }
  }, [dateRange, sessions]);

  // Prepare data for charts
  const chartData = filteredSessions.map(session => {
    const feedback = session.feedback || [];
    const validFeedback = feedback.filter(f => f !== null) as Feedback[];
    
    const avgScores = validFeedback.length > 0 ? {
      content: validFeedback.reduce((sum, f) => sum + f.content, 0) / validFeedback.length,
      structure: validFeedback.reduce((sum, f) => sum + f.structure, 0) / validFeedback.length,
      clarity: validFeedback.reduce((sum, f) => sum + f.clarity, 0) / validFeedback.length,
      delivery: validFeedback.reduce((sum, f) => sum + f.delivery, 0) / validFeedback.length,
    } : { content: 0, structure: 0, clarity: 0, delivery: 0 };

    return {
      date: new Date(session.timestamp).toLocaleDateString(),
      timestamp: session.timestamp,
      ...avgScores,
      overall: (avgScores.content + avgScores.structure + avgScores.clarity + avgScores.delivery) / 4,
      questions: session.totalQuestions || 0
    };
  }).sort((a, b) => a.timestamp - b.timestamp);

  // Calculate overall statistics
  const overallStats = {
    totalSessions: filteredSessions.length,
    avgContent: chartData.reduce((sum, d) => sum + d.content, 0) / chartData.length || 0,
    avgStructure: chartData.reduce((sum, d) => sum + d.structure, 0) / chartData.length || 0,
    avgClarity: chartData.reduce((sum, d) => sum + d.clarity, 0) / chartData.length || 0,
    avgDelivery: chartData.reduce((sum, d) => sum + d.delivery, 0) / chartData.length || 0,
    avgOverall: chartData.reduce((sum, d) => sum + d.overall, 0) / chartData.length || 0,
    totalQuestions: filteredSessions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0)
  };

  // Radar chart data
  const radarData = [
    { skill: 'Content', score: overallStats.avgContent, fullMark: 10 },
    { skill: 'Structure', score: overallStats.avgStructure, fullMark: 10 },
    { skill: 'Clarity', score: overallStats.avgClarity, fullMark: 10 },
    { skill: 'Delivery', score: overallStats.avgDelivery, fullMark: 10 }
  ];

  return (
    <div className="fixed inset-0 bg-black  bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-gray-300  rounded-lg max-w-7xl max-h-[95vh] overflow-y-auto w-full">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-gray-300 border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Interview Analytics</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Date Filter */}
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">Date Range Filter:</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">From:</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">To:</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <span className="text-sm text-gray-500">
                ({filteredSessions.length} of {sessions.length} sessions)
              </span>
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No sessions found in the selected date range.</p>
            </div>
          ) : (
            <>
              Statistics Cards
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-700">{overallStats.totalSessions}</div>
                  <div className="text-xs text-blue-600">Total Sessions</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-700">{overallStats.avgContent.toFixed(1)}</div>
                  <div className="text-xs text-purple-600">Avg Content</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-700">{overallStats.avgStructure.toFixed(1)}</div>
                  <div className="text-xs text-green-600">Avg Structure</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-700">{overallStats.avgClarity.toFixed(1)}</div>
                  <div className="text-xs text-yellow-600">Avg Clarity</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-700">{overallStats.avgDelivery.toFixed(1)}</div>
                  <div className="text-xs text-red-600">Avg Delivery</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-700">{overallStats.avgOverall.toFixed(1)}</div>
                  <div className="text-xs text-gray-600">Overall Avg</div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Progress Over Time - Line Chart */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 10]} />
                      {/* <Tooltip /> */}
                      <Legend />
                      <Line type="monotone" dataKey="content" stroke="#8b5cf6" name="Content" strokeWidth={2} />
                      <Line type="monotone" dataKey="structure" stroke="#3b82f6" name="Structure" strokeWidth={2} />
                      <Line type="monotone" dataKey="clarity" stroke="#10b981" name="Clarity" strokeWidth={2} />
                      <Line type="monotone" dataKey="delivery" stroke="#f59e0b" name="Delivery" strokeWidth={2} />
                      <Line type="monotone" dataKey="overall" stroke="#ef4444" name="Overall" strokeWidth={3} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Skills Radar Chart */}
                {/* <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Overview</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
                      <Radar
                        name="Average Score"
                        dataKey="score"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div> */}

                {/* Score Distribution - Bar Chart */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Scores by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { category: 'Content', score: overallStats.avgContent },
                      { category: 'Structure', score: overallStats.avgStructure },
                      { category: 'Clarity', score: overallStats.avgClarity },
                      { category: 'Delivery', score: overallStats.avgDelivery }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Session Volume Over Time */}
                {/* <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Questions Per Session</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="questions" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div> */}
              </div>

              {/* Detailed Sessions Table */}
              {/* <div className="mt-8 bg-white border rounded-lg">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Detailed Session Data</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Questions</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Content</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Structure</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Clarity</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Delivery</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Overall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((session, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm">{session.date}</td>
                          <td className="py-3 px-4 text-sm">{session.questions}</td>
                          <td className="py-3 px-4 text-sm font-medium">{session.content.toFixed(1)}</td>
                          <td className="py-3 px-4 text-sm font-medium">{session.structure.toFixed(1)}</td>
                          <td className="py-3 px-4 text-sm font-medium">{session.clarity.toFixed(1)}</td>
                          <td className="py-3 px-4 text-sm font-medium">{session.delivery.toFixed(1)}</td>
                          <td className="py-3 px-4 text-sm font-bold text-purple-700">{session.overall.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div> */}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Interview Detail Modal Component
const InterviewDetailModal = ({ session, onClose }: { session: InterviewSession; onClose: () => void }) => {
  const downloadFeedback = () => {
    let txt = `Interview Session - ${new Date(session.timestamp).toLocaleDateString()}\n\n`;
    
    session.questions.forEach((question, i) => {
      const feedback = session.feedback?.[i];
      const transcript = session.transcripts[i];
      
      txt += `Q${i + 1}: ${question}\n`;
      txt += `Your Answer: ${transcript || 'No transcript available'}\n`;
      
      if (feedback) {
        txt += `Scores: Content=${feedback.content}/10, Structure=${feedback.structure}/10, Clarity=${feedback.clarity}/10, Delivery=${feedback.delivery}/10\n`;
        txt += "Tips:\n";
        feedback.tips.forEach((tip) => {
          txt += `- ${tip.tip} (eg: "${tip.snippet}")\n`;
        });
      } else {
        txt += "No feedback available for this question.\n";
      }
      txt += "\n";
    });

    const element = document.createElement("a");
    element.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    element.download = `interview_feedback_${new Date(session.timestamp).toISOString().split('T')[0]}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto w-full">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Interview Details - {new Date(session.timestamp).toLocaleDateString()}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={downloadFeedback}
              className="flex items-center px-3 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 transition-colors text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Session Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Session Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Questions:</span>
                <p className="font-medium">{session.totalQuestions}</p>
              </div>
              <div>
                <span className="text-gray-500">Average Score:</span>
                <p className="font-medium">{session.averageScore}/10</p>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>
                <p className="font-medium">{new Date(session.timestamp).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-gray-500">Time:</span>
                <p className="font-medium">{new Date(session.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          </div>

          {/* Questions and Feedback */}
          {session.questions.map((question, i) => {
            const feedback = session.feedback?.[i];
            const transcript = session.transcripts[i];

            return (
              <div key={i} className="border rounded-lg p-4">
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Question {i + 1}</h4>
                  <p className="text-gray-700">{question}</p>
                </div>

                <div className="mb-4">
                  <h5 className="font-medium text-gray-900 mb-2">Your Answer</h5>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">
                    {transcript || 'No transcript available'}
                  </p>
                </div>

                {feedback ? (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Feedback & Scores</h5>
                    
                    {/* Scores */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-700">{feedback.content}</div>
                        <div className="text-xs text-gray-500">Content</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-700">{feedback.structure}</div>
                        <div className="text-xs text-gray-500">Structure</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-700">{feedback.clarity}</div>
                        <div className="text-xs text-gray-500">Clarity</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-700">{feedback.delivery}</div>
                        <div className="text-xs text-gray-500">Delivery</div>
                      </div>
                    </div>

                    {/* Tips */}
                    {feedback.tips && feedback.tips.length > 0 && (
                      <div>
                        <h6 className="font-medium text-gray-900 mb-2">Improvement Tips</h6>
                        <div className="space-y-2">
                          {feedback.tips.map((tip, tipIndex) => (
                            <div key={tipIndex} className="bg-blue-50 p-3 rounded-md">
                              <p className="text-sm text-gray-800 mb-1">{tip.tip}</p>
                              {tip.snippet && (
                                <p className="text-xs text-gray-600 italic">Example: "{tip.snippet}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">No feedback available for this question.</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
    const { data: session, status } = useSession();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [interviewSessions, setInterviewSessions] = useState<InterviewSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [loading, setLoading] = useState(true);

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    // Fetch interview sessions on component mount
    useEffect(() => {
        const fetchSessions = async () => {
            setLoading(true);
            try {
                // Replace this with your actual database function
                const sessions = await getInterviewSessions();
                console.log('Fetched interview sessions:', sessions);
                setInterviewSessions(sessions);
            } catch (error) {
                console.error('Error loading interview sessions:', error);
                setInterviewSessions([]);
            } finally {
                setLoading(false);
            }
        };

        if (status === 'authenticated') {
            fetchSessions();
        }
    }, [status]);

    // Get user initials for avatar (same logic as header)
    const getInitials = () => {
        if (session?.user?.name) {
            return session.user.name
                .split(' ')
                .map(name => name.charAt(0).toUpperCase())
                .join('')
                .slice(0, 2);
        }
        return "U";
    };

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };

    // Format date
    const formatDate = () => {
        return currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Format time
    const formatTime = () => {
        return currentTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Get score color based on value
    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-600';
        if (score >= 6) return 'text-yellow-600';
        return 'text-red-600';
    };

    // Loading state
    if (status === "loading") {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
            </div>
        );
    }

    // Not authenticated
    if (status === "unauthenticated") {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to access your dashboard</h1>
                    <button
                        onClick={() => window.location.href = '/login'}
                        className="px-6 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black">
            {/* Header Section */}
            <div className="bg-black text-white shadow-sm border-b shadow-lg border border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            {/* User Avatar */}
                            <div className="w-16 h-16 rounded-full bg-purple-700 flex items-center justify-center">
                                <span className="text-white font-bold text-xl">{getInitials()}</span>
                            </div>
                            
                            {/* Welcome Message */}
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                                    {getGreeting()}, {session?.user?.name || "User"}!
                                </h1>
                                <p className="text-white mt-1">Welcome back to your dashboard</p>
                            </div>
                        </div>

                        {/* Date and Time */}
                        <div className="hidden sm:block text-right">
                            <div className="flex items-center text-white mb-1">
                                <Calendar className="h-4 w-4 mr-2" />
                                <span className="text-sm">{formatDate()}</span>
                            </div>
                            <div className="flex items-center text-white">
                                <Clock className="h-4 w-4 mr-2" />
                                <span className="text-sm">{formatTime()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-black">
                {/* User Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* User Details Card */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border">
                        <div className="flex items-center mb-4">
                            <User className="h-6 w-6 text-purple-700 mr-3" />
                            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-gray-500">Name</label>
                                <p className="text-gray-900 font-medium">{session?.user?.name || "Not provided"}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500">Email</label>
                                <p className="text-gray-900 font-medium text-sm">{session?.user?.email || "Not provided"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Interview Stats */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border">
                        <div className="flex items-center mb-4">
                            <BarChart3 className="h-6 w-6 text-blue-600 mr-3" />
                            <h2 className="text-lg font-semibold text-gray-900">Interviews</h2>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Total Sessions</span>
                                <span className="font-bold text-2xl text-blue-600">{interviewSessions.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Avg Score</span>
                                <span className="font-bold text-lg">
                                    {interviewSessions.length > 0 
                                        ? (interviewSessions.reduce((sum, s) => sum + (s.averageScore || 0), 0) / interviewSessions.length).toFixed(1)
                                        : '0'
                                    }/10
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Latest Score */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border">
                        <div className="flex items-center mb-4">
                            <Star className="h-6 w-6 text-yellow-500 mr-3" />
                            <h2 className="text-lg font-semibold text-gray-900">Latest Score</h2>
                        </div>
                        <div className="text-center">
                            <div className={`text-3xl font-bold ${getScoreColor(interviewSessions[0]?.averageScore || 0)}`}>
                                {interviewSessions[0]?.averageScore || 'N/A'}
                                {interviewSessions[0]?.averageScore && '/10'}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                {interviewSessions[0] ? new Date(interviewSessions[0].timestamp).toLocaleDateString() : 'No sessions yet'}
                            </p>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-lg shadow-sm p-6 border">
                        <div className="flex items-center mb-4">
                            <TrendingUp className="h-6 w-6 text-green-600 mr-3" />
                            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                        </div>
                        <div className="space-y-2">
                            <button 
                                onClick={() => window.location.href = '/resume-questions'}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                Start New Interview
                            </button>
                            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                                Practice Questions
                            </button>
                            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                                View Data
                            </button>
                        </div>
                    </div>
                </div>

                {/* Interview History Section */}
                <div className="bg-white rounded-lg shadow-sm border">
                    <div className="px-6 py-4 border-b">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <FileText className="h-6 w-6 text-purple-700 mr-3" />
                                <h2 className="text-xl font-semibold text-gray-900">Interview History</h2>
                            </div>
                            <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-500">{interviewSessions.length} sessions</span>
                                {interviewSessions.length > 0 && (
                                    <button
                                        onClick={() => setShowAnalytics(true)}
                                        className="flex items-center px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 transition-colors text-sm"
                                    >
                                        <BarChart3 className="h-4 w-4 mr-2" />
                                        View Analytics
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700"></div>
                                <span className="ml-2 text-gray-600">Loading interview history...</span>
                            </div>
                        ) : interviewSessions.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews yet</h3>
                                <p className="text-gray-500 mb-4">Start your first interview to see your history here</p>
                                <button 
                                    onClick={() => window.location.href = '/interview'}
                                    className="px-4 py-2 bg-purple-700 text-white rounded-md hover:bg-purple-600 transition-colors"
                                >
                                    Start Interview
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Questions</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Avg Score</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Content</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Structure</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Clarity</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Delivery</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-900">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {interviewSessions.map((session) => {
                                            const avgFeedback = (session.feedback || []).reduce((acc, f) => {
                                                if (f) {
                                                    acc.content += f.content;
                                                    acc.structure += f.structure;
                                                    acc.clarity += f.clarity;
                                                    acc.delivery += f.delivery;
                                                    acc.count++;
                                                }
                                                return acc;
                                            }, { content: 0, structure: 0, clarity: 0, delivery: 0, count: 0 });

                                            return (
                                                <tr key={session.id} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4">
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {new Date(session.timestamp).toLocaleDateString()}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {new Date(session.timestamp).toLocaleTimeString()}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            {session.totalQuestions} questions
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`font-bold ${getScoreColor(session.averageScore || 0)}`}>
                                                            {session.averageScore}/10
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`font-medium ${getScoreColor(avgFeedback.count > 0 ? avgFeedback.content / avgFeedback.count : 0)}`}>
                                                            {avgFeedback.count > 0 ? (avgFeedback.content / avgFeedback.count).toFixed(1) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`font-medium ${getScoreColor(avgFeedback.count > 0 ? avgFeedback.structure / avgFeedback.count : 0)}`}>
                                                            {avgFeedback.count > 0 ? (avgFeedback.structure / avgFeedback.count).toFixed(1) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`font-medium ${getScoreColor(avgFeedback.count > 0 ? avgFeedback.clarity / avgFeedback.count : 0)}`}>
                                                            {avgFeedback.count > 0 ? (avgFeedback.clarity / avgFeedback.count).toFixed(1) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`font-medium ${getScoreColor(avgFeedback.count > 0 ? avgFeedback.delivery / avgFeedback.count : 0)}`}>
                                                            {avgFeedback.count > 0 ? (avgFeedback.delivery / avgFeedback.count).toFixed(1) : 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => setSelectedSession(session)}
                                                            className="inline-flex items-center px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md text-sm font-medium transition-colors"
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            View Details
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Date/Time (visible on small screens) */}
                <div className="sm:hidden mt-6 bg-white rounded-lg shadow-sm p-4 border">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>{formatDate()}</span>
                        </div>
                        <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            <span>{formatTime()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interview Detail Modal */}
            {selectedSession && (
                <InterviewDetailModal
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                />
            )}

            {/* Analytics Modal */}
            {showAnalytics && (
                <AnalyticsModal
                    sessions={interviewSessions}
                    onClose={() => setShowAnalytics(false)}
                />
            )}
        </div>
    );
}
