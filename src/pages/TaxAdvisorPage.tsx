import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, FileText, Download } from "lucide-react";

const taxDeadlines = [
  { name: "USt-Voranmeldung Q1 2026", due: "2026-04-10", status: "Due soon" as const },
  { name: "Körperschaftsteuer 2025", due: "2026-05-31", status: "In preparation" as const },
  { name: "Gewerbesteuer 2025", due: "2026-06-15", status: "On track" as const },
  { name: "Jahresabschluss 2025", due: "2026-07-31", status: "Not started" as const },
];

const statusColor = (s: string) => {
  if (s === "Due soon") return "bg-destructive/10 text-destructive";
  if (s === "In preparation") return "bg-warning/10 text-warning";
  if (s === "On track") return "bg-success/10 text-success";
  return "bg-muted text-muted-foreground";
};

export default function TaxAdvisorPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold">Tax Advisor</h1><p className="text-muted-foreground text-sm">Tax advisor portal and document exchange</p></div>
        <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1.5" />Export for advisor</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Tax deadlines</CardTitle></CardHeader>
          <CardContent className="space-y-0">
            {taxDeadlines.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1">{t.name}</span>
                <span className="text-sm text-muted-foreground mr-2">{new Date(t.due).toLocaleDateString("de-DE")}</span>
                <Badge variant="secondary" className={`text-xs ${statusColor(t.status)}`}>{t.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Shared documents</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No documents shared with your tax advisor yet. Use the DATEV export from the Accounting page.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
