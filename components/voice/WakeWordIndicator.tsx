"use client";

type Props = {
  wsState: "connecting" | "open" | "closed";
  wakeDetected: boolean;
};

export function WakeWordIndicator({ wsState, wakeDetected }: Props) {
  if (!process.env.NEXT_PUBLIC_AUDIO_SERVER_WS_URL) return null;

  let dotClass: string;
  let label: string;

  if (wsState === "connecting") {
    dotClass = "w-2 h-2 rounded-full bg-gray-400 animate-pulse";
    label = "Connecting...";
  } else if (wsState === "closed") {
    dotClass = "w-2 h-2 rounded-full bg-red-500";
    label = "Wake word offline";
  } else if (wakeDetected) {
    dotClass = "w-2 h-2 rounded-full bg-green-500 animate-ping";
    label = "Wake word detected!";
  } else {
    dotClass = "w-2 h-2 rounded-full bg-blue-500 animate-pulse";
    label = "Listening for wake word...";
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span className={dotClass} />
      <span>{label}</span>
    </div>
  );
}
