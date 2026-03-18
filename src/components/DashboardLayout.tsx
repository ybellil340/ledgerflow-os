import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserMenu } from "@/components/UserMenu";
import { Outlet, useLocation } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/wallets": "Wallets",
  "/cards": "Cards",
  "/expenses": "Expenses",
  "/reimbursements": "Reimbursements",
  "/ap-invoices": "AP Invoices",
  "/ar-invoices": "AR Invoices",
  "/budgets": "Budgets",
  "/suppliers": "Suppliers",
  "/customers": "Customers",
  "/accounting": "Accounting",
  "/cash-flow": "Cash Flow",
  "/tax-advisor": "Tax Advisor",
  "/reports": "Reports",
  "/team": "Team",
  "/billing": "Billing",
  "/integrations": "Integrations",
  "/notifications": "Notifications",
  "/import-data": "Import Data",
  "/admin": "Admin",
  "/audit-log": "Audit Log",
};

export default function DashboardLayout() {
  const location = useLocation();
  const { orgId } = useOrganization();
  const pageTitle = routeTitles[location.pathname] ?? "LedgerFlow";

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", orgId],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header bar */}
          <header className="h-14 flex items-center border-b bg-card/80 backdrop-blur-sm px-4 shrink-0 sticky top-0 z-30 gap-3">
            <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" />

            {/* Page title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-sm font-semibold text-foreground truncate">
                {pageTitle}
              </span>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Search hint */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:flex items-center gap-2 text-muted-foreground text-xs h-8 px-3 rounded-lg border border-border/60 hover:bg-accent hover:text-foreground transition-all"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
                <kbd className="ml-1 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>

              {/* Notifications */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent relative transition-all"
                onClick={() => window.location.href = "/notifications"}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              {/* Divider */}
              <div className="h-5 w-px bg-border mx-1" />

              {/* User menu */}
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
