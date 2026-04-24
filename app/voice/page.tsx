import { VoiceSession } from "@/components/voice/VoiceSession";

export default function VoicePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">Family Assistant</h1>
      <VoiceSession />
    </main>
  );
}
