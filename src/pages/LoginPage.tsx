import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3 } from "lucide-react";

const demoUsers = [
  { role: "Company Admin", username: "katrin.mueller", email: "katrin@mueller-consulting.de" },
  { role: "Finance Manager", username: "sara.mayer", email: "sara@mueller-consulting.de" },
  { role: "Tax Advisor", username: "weber", email: "weber@steuerberatung.de" },
];

const stats = [
  { value: "€2.4M", label: "Processed monthly" },
  { value: "98%", label: "DATEV accuracy" },
  { value: "3h", label: "Saved per week" },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleDemoFill = (user: typeof demoUsers[0]) => {
    setEmail(user.email);
    setPassword("demo123");
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[440px] xl:w-[480px] surface-dark flex-col justify-between p-10 relative overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-dark-muted/50 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-accent" />
            </div>
            <span className="font-display text-xl font-semibold text-primary-foreground">LedgerFlow</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 space-y-8"
        >
          <blockquote className="space-y-4">
            <p className="text-lg leading-relaxed text-primary-foreground/80 font-body">
              "Finally a financial platform that understands German SMEs — DATEV, VAT logic, tax advisor collaboration in one place."
            </p>
            <footer className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-display text-sm font-semibold text-accent">
                KM
              </div>
              <div>
                <p className="font-display text-sm font-medium text-primary-foreground">Katrin Müller</p>
                <p className="text-sm text-primary-foreground/50">CFO, Müller Consulting GmbH</p>
              </div>
            </footer>
          </blockquote>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <div className="flex gap-3">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 rounded-lg bg-surface-dark-muted/60 p-3.5 backdrop-blur-sm border border-primary-foreground/5"
              >
                <p className="font-display text-xl font-bold text-primary-foreground">{stat.value}</p>
                <p className="text-xs text-primary-foreground/50 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px] space-y-8"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden mb-6">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold">LedgerFlow</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-1.5">Sign in to your LedgerFlow account</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-sm text-accent hover:text-accent/80 transition-colors">
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" variant="accent" size="lg" className="w-full">
              Sign in
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-sm font-display font-medium text-muted-foreground">Demo — click to fill</p>
            <div className="space-y-1">
              {demoUsers.map((user) => (
                <button
                  key={user.username}
                  onClick={() => handleDemoFill(user)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-secondary transition-colors text-left group"
                >
                  <span className="text-sm font-medium">{user.role}</span>
                  <code className="text-xs text-muted-foreground font-mono group-hover:text-accent transition-colors">
                    {user.username}
                  </code>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Password: <code className="font-mono text-foreground/70">demo123</code>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
