"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { org_name: orgName, role: "super_admin" } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="bg-background rounded-2xl p-8 shadow-sm border border-border">
      <div className="text-center mb-8">
        <div className="w-12 h-12 mx-auto bg-accent rounded-xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        </div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Set up workspace</h1>
        <p className="text-[13px] text-foreground-tertiary mt-1">Create a new command centre</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-[13px] text-destructive">{error}</div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="orgName" className="text-[13px] font-medium">Organisation Name</Label>
          <Input id="orgName" placeholder="Creative Nexus" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium">Work Email</Label>
          <Input id="email" type="email" placeholder="you@acme.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/90 text-white">
          {loading ? "Creating..." : "Create Workspace"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-foreground-tertiary mt-6">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">Sign In</Link>
      </p>
    </div>
  );
}
