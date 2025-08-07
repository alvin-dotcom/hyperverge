// app/speech-feedback/util/db.ts

export function openInterviewDB(): Promise<IDBDatabase> {
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

export async function saveInterviewSession(
  questions: string[],
  answers: Blob[],
  transcripts: string[],
  feedback?: any[]
) {
  const db = await openInterviewDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction("answers", "readwrite");
    const store = tx.objectStore("answers");
    const data = {
      timestamp: Date.now(),
      questions,
      answers,
      transcripts,
      feedback,
    };
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}
