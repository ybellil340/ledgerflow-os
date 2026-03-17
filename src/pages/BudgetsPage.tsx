import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, PiggyBank } from "lucide-react";

export default function BudgetsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold">Budgets</h1><p className="text-muted-foreground text-sm">Set and track spending budgets by department or cost center</p></div>
        <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Create budget</Button>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <PiggyBank className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No budgets configured yet. Create your first budget to start tracking spending against targets.</p>
        </CardContent>
      </Card>
    </div>
  );
}
