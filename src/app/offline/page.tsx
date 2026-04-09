import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="bg-muted mb-4 rounded-full p-4">
        <WifiOff className="text-muted-foreground h-8 w-8" />
      </div>
      <h1 className="mb-2 text-xl font-bold">You&apos;re Offline</h1>
      <p className="text-muted-foreground text-sm">Check your internet connection and try again.</p>
    </div>
  );
}
