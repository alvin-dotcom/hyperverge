'use client'
type Tip = { tip: string; reference: string };
type Scores = { [key: string]: number };

export function FeedbackPanel({
  scores,
  tips,
  onRetry,
}: {
  scores: Scores;
  tips: Tip[];
  onRetry: () => void;
}) {
  return (
    <div className="bg-blue-50 border p-4 rounded my-2">
      <div className="flex gap-8 mb-2">
        {Object.entries(scores).map(([k, v]) => (
          <div key={k}>
            <span className="uppercase">{k}</span>: <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>
      <ul>
        {tips.map((t, i) => (
          <li key={i} className="mb-1">
            <b>Tip:</b> {t.tip} <span className="text-xs text-gray-500">({t.reference})</span>
          </li>
        ))}
      </ul>
      <button className="mt-2 px-3 py-1 bg-green-200 rounded" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}