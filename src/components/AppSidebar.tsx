import {
  LayoutDashboard, CreditCard, Receipt, RefreshCw, FileText, FileOutput,
  PiggyBank, Users, Building2, Calculator, TrendingUp, Briefcase, Wallet,
  BarChart3, UserCog, DollarSign, Plug, Bell, Download, Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useOrganization } from "@/hooks/useOrganization";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const navSections = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Finance",
    items: [
      { title: "Wallets",         url: "/wallets",        icon: Wallet },
      { title: "Cards",           url: "/cards",          icon: CreditCard },
      { title: "Expenses",        url: "/expenses",        icon: Receipt },
      { title: "Reimbursements",  url: "/reimbursements", icon: RefreshCw },
      { title: "AP Invoices",     url: "/ap-invoices",    icon: FileText },
      { title: "AR Invoices",     url: "/ar-invoices",    icon: FileOutput },
      { title: "Budgets",         url: "/budgets",        icon: PiggyBank },
    ],
  },
  {
    label: "Directory",
    items: [
      { title: "Suppliers", url: "/suppliers", icon: Building2 },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "Accounting",
    items: [
      { title: "Accounting",  url: "/accounting", icon: Calculator },
      { title: "Cash Flow",   url: "/cash-flow",  icon: TrendingUp },
      { title: "Tax Advisor", url: "/tax-advisor",icon: Briefcase },
      { title: "Reports",     url: "/reports",    icon: BarChart3 },
    ],
  },
  {
    label: "Company",
    items: [
      { title: "Team",         url: "/team",        icon: UserCog },
      { title: "Billing",      url: "/billing",     icon: DollarSign },
      { title: "Integrations", url: "/integrations",icon: Plug },
      { title: "Notifications",url: "/notifications",icon: Bell },
      { title: "Import data",  url: "/import-data", icon: Download },
    ],
  },
  {
    label: "Platform",
    items: [{ title: "Admin", url: "/admin", icon: Shield }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { organization } = useOrganization();

  return (
    <Sidebar collapsible="icon" className="border-r-0 shadow-xl">
      {/* Logo / Brand */}
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0 shadow-sm">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold text-sidebar-accent-foreground tracking-tight leading-tight">
                LedgerFlow
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-sidebar-foreground/60 truncate leading-tight max-w-[110px]">
                  {organization?.name ?? ""}
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-sidebar-primary/25 text-sidebar-primary uppercase tracking-wider shrink-0 leading-none">
                  DE
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2 py-3 overflow-y-auto scrollbar-none">
        {navSections.map((section, sectionIdx) => (
          <SidebarGroup key={section.label} className={sectionIdx > 0 ? "mt-1" : ""}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.1em] text-sidebar-foreground/35 uppercase px-2 py-1 mb-0.5">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={collapsed ? item.title : undefined}
                        className="h-8"
                      >
                        <NavLink
                          to={item.url}
                          end
                          className={[
                            "flex items-center gap-2.5 w-full rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150",
                            isActive
                              ? "bg-sidebar-primary text-white shadow-sm"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          ].join(" ")}
                        >
                          <item.icon className="h-[15px] w-[15px] shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
