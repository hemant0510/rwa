import Link from "next/link";

import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center">
        <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <FileQuestion className="text-muted-foreground h-8 w-8" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Page Not Found</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          The page you are looking for does not exist or has been moved.
        </p>
        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
