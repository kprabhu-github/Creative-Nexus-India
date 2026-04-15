import { ReactNode } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="w-full p-5 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
