import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const stats = [
  { value: "€2.4M", label: "Processed monthly" },
  { value: "98%", label: "DATEV accuracy" },
  { value: "3h", label: "Saved per week" },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, { first_name: firstName, last_name: lastName });
        if (error) throw error;
        toast({ title: "Account created", description: "Check your email to confirm your account." });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — dark brand panel */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[460px] bg-primary flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary/20 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-sidebar-primary" />
          </div>
          <span className="text-lg font-semibold text-primary-foreground">LedgerFlow</span>
        </div>

        <div className="space-y-6">
          <blockquote>
            <p className="text-base leading-relaxed text-primary-foreground/75">
              "Finally a financial platform that understands German SMEs — DATEV, VAT logic, tax advisor collaboration in one place."
            </p>
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sm font-semibold text-sidebar-primary-foreground">
              KM
            </div>
            <div>
              <p className="text-sm font-medium text-primary-foreground">Katrin Müller</p>
              <p className="text-sm text-primary-foreground/50">CFO, Müller Consulting GmbH</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex-1 rounded-md bg-sidebar-accent p-3">
              <p className="text-lg font-bold text-primary-foreground">{stat.value}</p>
              <p className="text-xs text-primary-foreground/50">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-card">
        <div className="w-full max-w-[380px] space-y-6">
          <div className="flex items-center gap-2.5 lg:hidden mb-4">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">LedgerFlow</span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold">{isSignUp ? "Create account" : "Welcome back"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isSignUp ? "Start managing your finances" : "Sign in to your LedgerFlow account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="you@company.de" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" required />
            </div>
            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-foreground font-medium hover:underline">
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
