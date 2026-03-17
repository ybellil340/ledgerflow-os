import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
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
  "/import-data": "Import data",
  "/admin": "Admin",
};

export default function PlaceholderPage() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Page";

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-1">{title}</h1>
      <p className="text-muted-foreground text-sm">This section is under development.</p>
    </div>
  );
}
