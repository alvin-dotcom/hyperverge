'use client'
type Segment = { text: string; start: number; end: number };

type Tip = { tip: string; reference: string };

export function TranscriptHighlighter({
  segments,
  tips,
}: {
  segments: Segment[];
  tips: Tip[];
}) {
  function getTipForSegment(seg: Segment, idx: number): string | null {
    for (const tip of tips) {
      // Handle both "line x" and "timestamp mm:ss"
      if (tip.reference.match(new RegExp(`line\\s*${idx + 1}`, "i"))) return tip.tip;
      if (tip.reference.match(/timestamp\s*(\d+:\d+)/i)) {
        const [, time] = tip.reference.match(/timestamp\s*(\d+:\d+)/i)!;
        const segTime = seg.start;
        const [min, sec] = time.split(":").map(Number);
        const tipSec = min * 60 + sec;
        if (Math.abs(segTime - tipSec) < 2) return tip.tip;
      }
    }
    return null;
  }
  return (
    <div className="my-3 p-3 bg-slate-50 border rounded">
      <span className="font-semibold">Transcript: </span>
      {segments && segments.length ? (
        <div>
          {segments.map((seg, i) => {
            const tip = getTipForSegment(seg, i);
            return (
              <span
                key={i}
                className={`px-1 ${
                  tip ? "bg-yellow-200 underline cursor-help" : ""
                }`}
                title={tip || ""}
              >
                [{seg.start.toFixed(1)}s] {seg.text}
              </span>
            );
          })}
        </div>
      ) : (
        <span>-</span>
      )}
    </div>
  );
}