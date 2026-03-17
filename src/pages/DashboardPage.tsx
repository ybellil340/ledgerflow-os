import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statCards = [
  { title: "Total spend this month", value: "0 €" },
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

const StatusBadge = ({ status, color }: { status: string; color: "destructive" | "warning" | "success" }) => {
  const styles = {
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
  };
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded", styles[color])}>{status}</span>;
};

export default function DashboardPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground mb-1.5">{stat.title}</p>
              <p className={cn(
                "text-2xl font-semibold",
                stat.highlight === "warning" && "text-warning",
                stat.highlight === "destructive" && "text-destructive",
              )}>
                {stat.value}
              </p>
              {stat.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{stat.subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {pendingApprovals.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-sidebar-primary-foreground">KM</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.company}</p>
                </div>
                <span className="text-sm font-semibold mr-3 whitespace-nowrap">{a.amount}</span>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 text-success border-success/30 hover:bg-success/10">Approve</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10">Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Spend by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No data yet</p>
          </CardContent>
        </Card>

        {/* Tax Obligations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tax obligations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {taxObligations.map((tax, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                <div className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  tax.color === "destructive" && "bg-destructive",
                  tax.color === "warning" && "bg-warning",
                  tax.color === "success" && "bg-success",
                )} />
                <span className="text-sm flex-1">{tax.name}</span>
                <span className="text-sm text-muted-foreground mr-2">{tax.date}</span>
                <StatusBadge status={tax.status} color={tax.color} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
