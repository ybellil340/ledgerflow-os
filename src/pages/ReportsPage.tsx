import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, FileText, Download } from "lucide-react";

const reports = [
  { name: "Expense report", description: "Summary of all expenses by category and status", icon: BarChart3 },
  { name: "AP aging report", description: "Accounts payable aging by due date", icon: FileText },
  { name: "AR aging report", description: "Accounts receivable aging by due date", icon: FileText },
  { name: "Profit & Loss", description: "Revenue vs expenses overview", icon: BarChart3 },
  { name: "VAT report", description: "VAT collected vs paid for filing", icon: FileText },
  { name: "Budget vs actual", description: "Compare budgeted vs actual spending", icon: BarChart3 },
];

export default function ReportsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-muted-foreground text-sm">Generate and export financial reports</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.name} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <r.icon className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full"><Download className="h-3.5 w-3.5 mr-1.5" />Generate</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
