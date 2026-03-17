import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Users, Building2 } from "lucide-react";

const importTypes = [
  { name: "Suppliers", description: "Import suppliers from CSV", icon: Building2 },
  { name: "Customers", description: "Import customers from CSV", icon: Users },
  { name: "Chart of Accounts", description: "Import SKR03/SKR04 accounts", icon: FileText },
  { name: "Transactions", description: "Import bank transactions from CSV/MT940", icon: FileText },
];

export default function ImportDataPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1000px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Import Data</h1>
        <p className="text-muted-foreground text-sm">Bulk import data from CSV or other formats</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {importTypes.map((t) => (
          <Card key={t.name} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <t.icon className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full"><Upload className="h-3.5 w-3.5 mr-1.5" />Upload file</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
