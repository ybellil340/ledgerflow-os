import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="p-6 lg:p-8 max-w-[800px]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="text-muted-foreground text-sm">Manage your subscription and payment methods</p>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Current plan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">Professional</p>
              <p className="text-sm text-muted-foreground">€49/month • Up to 25 users</p>
            </div>
            <Badge className="text-xs bg-success/10 text-success">Active</Badge>
          </div>
          <Button variant="outline" size="sm" className="mt-4">Upgrade plan</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Payment method</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">•••• •••• •••• 4242</p>
              <p className="text-xs text-muted-foreground">Expires 12/2027</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-4">Update payment method</Button>
        </CardContent>
      </Card>
    </div>
  );
}
