export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/50 flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
