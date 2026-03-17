import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  RefreshCw,
  FileText,
  FileOutput,
  PiggyBank,
  Users,
  Building2,
  Calculator,
  TrendingUp,
  Briefcase,
  BarChart3,
  UserCog,
  DollarSign,
  Plug,
  Bell,
  Download,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navSections = [
  {
    label: "OVERVIEW",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { title: "Cards", url: "/cards", icon: CreditCard },
      { title: "Expenses", url: "/expenses", icon: Receipt },
      { title: "Reimbursements", url: "/reimbursements", icon: RefreshCw },
      { title: "AP Invoices", url: "/ap-invoices", icon: FileText },
      { title: "AR Invoices", url: "/ar-invoices", icon: FileOutput },
      { title: "Budgets", url: "/budgets", icon: PiggyBank },
    ],
  },
  {
    label: "DIRECTORY",
    items: [
      { title: "Suppliers", url: "/suppliers", icon: Building2 },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { title: "Accounting", url: "/accounting", icon: Calculator },
      { title: "Cash Flow", url: "/cash-flow", icon: TrendingUp },
      { title: "Tax Advisor", url: "/tax-advisor", icon: Briefcase },
      { title: "Reports", url: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "COMPANY",
    items: [
      { title: "Team", url: "/team", icon: UserCog },
      { title: "Billing", url: "/billing", icon: DollarSign },
      { title: "Integrations", url: "/integrations", icon: Plug },
      { title: "Notifications", url: "/notifications", icon: Bell },
      { title: "Import data", url: "/import-data", icon: Download },
    ],
  },
  {
    label: "PLATFORM",
    items: [
      { title: "Admin", url: "/admin", icon: Shield },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-sidebar-primary" />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold text-sidebar-accent-foreground">
                LedgerFlow
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sidebar-primary/20 text-sidebar-primary uppercase tracking-wider">
                DE
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.1em] text-sidebar-foreground/40 uppercase px-3 mb-1">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={collapsed ? item.title : undefined}
                      >
                        <NavLink
                          to={item.url}
                          end
                          className="transition-colors duration-150"
                          activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
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
