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
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Set up workspace
        </h1>
        <p className="text-sm text-foreground-tertiary mt-1.5">
          Create a new command centre
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-destructive/10 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="orgName" className="text-[13px] font-medium">
            Organisation Name
          </Label>
          <Input
            id="orgName"
            placeholder="Creative Nexus"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[13px] font-medium">
            Work Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@acme.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[13px] font-medium">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-medium"
        >
          {loading ? "Creating..." : "Create Workspace"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-foreground-tertiary mt-8">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-foreground hover:text-accent transition-colors">
          Sign in
        </Link>
      </p>
    </>
  );
}
