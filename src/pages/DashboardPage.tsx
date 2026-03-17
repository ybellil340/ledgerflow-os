import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statCards = [
  { title: "Total spend this month", value: "0 €", subtitle: undefined },
  { title: "Cash position", value: "124.500 €", subtitle: "Across linked accounts" },
  { title: "Pending approvals", value: "3", highlight: "warning" as const },
  { title: "Missing receipts", value: "4", highlight: "destructive" as const },
];

const pendingApprovals = [
  { name: "Katrin Müller", company: "Conrad Electronics", amount: "249 €" },
  { name: "Katrin Müller", company: "Marriott Berlin", amount: "420 €" },
  { name: "Katrin Müller", company: "AWS Frankfurt", amount: "1.240 €" },
];

const taxObligations = [
  { name: "USt-Voranmeldung Q1", date: "10 Apr", status: "Due", color: "destructive" as const },
  { name: "Koerperschaftsteuer", date: "31 Mai", status: "Prep", color: "warning" as const },
  { name: "Gewerbesteuer", date: "15 Jun", status: "On track", color: "success" as const },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

const StatusBadge = ({ status, color }: { status: string; color: "destructive" | "warning" | "success" }) => {
  const colorMap = {
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-success/10 text-success border-success/20",
  };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", colorMap[color])}>
      {status}
    </span>
  );
};

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Overview</p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"
      >
        {statCards.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card className="shadow-card border">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-2">{stat.title}</p>
                <p
                  className={cn(
                    "font-display text-2xl font-bold",
                    stat.highlight === "warning" && "text-warning",
                    stat.highlight === "destructive" && "text-destructive",
                    !stat.highlight && "text-foreground"
                  )}
                >
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Pending Approvals */}
        <motion.div variants={item}>
          <Card className="shadow-card border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-5 pb-5">
              {pendingApprovals.map((approval, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 border-b last:border-0"
                >
                  <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-display font-semibold text-accent">KM</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{approval.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{approval.company}</p>
                  </div>
                  <span className="text-sm font-display font-semibold whitespace-nowrap mr-3">
                    {approval.amount}
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-success border-success/30 hover:bg-success/10">
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-destructive border-destructive/30 hover:bg-destructive/10">
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Spend by Category */}
        <motion.div variants={item}>
          <Card className="shadow-card border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Spend by category</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className="text-sm text-muted-foreground">No data yet</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tax Obligations */}
        <motion.div variants={item}>
          <Card className="shadow-card border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tax obligations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-5 pb-5">
              {taxObligations.map((tax, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 border-b last:border-0"
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      tax.color === "destructive" && "bg-destructive",
                      tax.color === "warning" && "bg-warning",
                      tax.color === "success" && "bg-success"
                    )}
                  />
                  <span className="text-sm flex-1">{tax.name}</span>
                  <span className="text-sm text-muted-foreground mr-2">{tax.date}</span>
                  <StatusBadge status={tax.status} color={tax.color} />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={item}>
          <Card className="shadow-card border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent transactions</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
