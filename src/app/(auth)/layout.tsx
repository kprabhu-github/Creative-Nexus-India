import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-secondary">
      <main className="w-full max-w-sm px-6">
        {children}
      </main>
    </div>
  );
}
