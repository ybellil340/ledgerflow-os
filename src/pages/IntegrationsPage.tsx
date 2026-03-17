import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug } from "lucide-react";

const integrations = [
  { name: "DATEV", description: "Export data to DATEV for your tax advisor", status: "available" },
  { name: "Stripe", description: "Accept payments and sync transactions", status: "available" },
  { name: "Slack", description: "Get expense approval notifications in Slack", status: "coming_soon" },
  { name: "QuickBooks", description: "Sync with QuickBooks accounting", status: "coming_soon" },
  { name: "Bank API (PSD2)", description: "Connect bank accounts via open banking", status: "coming_soon" },
  { name: "Google Drive", description: "Auto-backup receipts and documents", status: "coming_soon" },
];

export default function IntegrationsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground text-sm">Connect third-party services</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((i) => (
          <Card key={i.name}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Plug className="h-5 w-5 text-primary" />
                  <p className="text-sm font-semibold">{i.name}</p>
                </div>
                <Badge variant="secondary" className={`text-xs ${i.status === "available" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {i.status === "available" ? "Available" : "Coming soon"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{i.description}</p>
              <Button size="sm" variant="outline" className="w-full" disabled={i.status !== "available"}>
                {i.status === "available" ? "Connect" : "Notify me"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
