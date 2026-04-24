"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Check, ArrowRight } from "lucide-react";

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

const PHRASES = [
  "The quick brown fox jumps over the lazy dog",
  "She sells seashells by the seashore",
  "How much wood would a woodchuck chuck",
];

export default function NewProfilePage() {
  const router = useRouter();
  const [step, setStep] = useState<"info" | "recording" | "done">("info");
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [recordedCount, setRecordedCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const createProfile = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (!res.ok) throw new Error("Failed to create profile");
      const profile = await res.json();
      setProfileId(profile.id);
      setStep("recording");
    } catch {
      setError("Could not create profile. Try again.");
    }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setError("Microphone access denied");
    }
  }, []);

  const stopAndUpload = useCallback(async () => {
    if (!recorderRef.current || !profileId) return;
    const recorder = recorderRef.current;
    recorder.stop();
    recorderRef.current = null;
    setIsRecording(false);
    setIsUploading(true);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", blob, "sample.webm");
      const res = await fetch(`/api/profiles/${profileId}/enroll`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const newCount = recordedCount + 1;
      setRecordedCount(newCount);
      if (newCount >= PHRASES.length) {
        setStep("done");
      } else {
        setPhraseIdx(newCount);
      }
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  }, [profileId, recordedCount]);

  if (step === "info") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md space-y-6">
          <h1 className="text-2xl font-bold text-gray-800">Add Family Member</h1>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dad, Alice, Mom..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && createProfile()}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={[
                    "w-8 h-8 rounded-full border-2 transition-transform",
                    color === c ? "border-gray-800 scale-110" : "border-transparent",
                  ].join(" ")}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={createProfile}
            disabled={!name.trim()}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next: Record Voice Samples
          </button>
        </div>
      </main>
    );
  }

  if (step === "recording") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Record Voice Samples</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sample {recordedCount + 1} of {PHRASES.length}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex gap-2">
            {PHRASES.map((_, i) => (
              <div
                key={i}
                className={[
                  "h-2 flex-1 rounded-full transition-colors",
                  i < recordedCount ? "bg-green-500" : i === phraseIdx ? "bg-blue-500" : "bg-gray-200",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Phrase to read */}
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-gray-500 text-xs mb-1">Read aloud:</p>
            <p className="text-gray-800 font-medium text-lg">
              &quot;{PHRASES[phraseIdx]}&quot;
            </p>
          </div>

          {/* Recorded phrases */}
          {recordedCount > 0 && (
            <ul className="space-y-1">
              {PHRASES.slice(0, recordedCount).map((_, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-green-700">
                  <Check className="w-4 h-4" />
                  Sample {i + 1} recorded
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Record button */}
          <button
            onPointerDown={!isUploading ? startRecording : undefined}
            onPointerUp={isRecording ? stopAndUpload : undefined}
            onPointerLeave={isRecording ? stopAndUpload : undefined}
            disabled={isUploading}
            className={[
              "w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-colors",
              isRecording ? "bg-red-500 animate-pulse" : isUploading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700",
            ].join(" ")}
          >
            {isRecording ? (
              <><MicOff className="w-5 h-5" /> Release to stop</>
            ) : isUploading ? (
              "Uploading..."
            ) : (
              <><Mic className="w-5 h-5" /> Hold to record</>
            )}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Enrollment Complete!</h1>
          <p className="text-gray-500 mt-1">
            {name} is now enrolled with {PHRASES.length} voice samples.
          </p>
        </div>
        <button
          onClick={() => router.push("/voice")}
          className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          Go to Voice Assistant <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </main>
  );
}
