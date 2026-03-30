// src/App.tsx
// PATCHED: added /transactions route + TransactionsPage import.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import SeedPage from "./pages/SeedPage";
import WalletsPage from "./pages/WalletsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import TeamPage from "./pages/TeamPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReimbursementsPage from "./pages/ReimbursementsPage";
import APInvoicesPage from "./pages/APInvoicesPage";
import ARInvoicesPage from "./pages/ARInvoicesPage";
import SuppliersPage from "./pages/SuppliersPage";
import CustomersPage from "./pages/CustomersPage";
import AccountingPage from "./pages/AccountingPage";
import CashFlowPage from "./pages/CashFlowPage";
import TaxAdvisorPage from "./pages/TaxAdvisorPage";
import ReportsPage from "./pages/ReportsPage";
import CardsPage from "./pages/CardsPage";
import TransactionsPage from "./pages/TransactionsPage"; // Phase B
import BudgetsPage from "./pages/BudgetsPage";
import BillingPage from "./pages/BillingPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import NotificationsPage from "./pages/NotificationsPage";
import ImportDataPage from "./pages/ImportDataPage";
import AdminPage from "./pages/AdminPage";
import AuditLogPage from "./pages/AuditLogPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* Protected seed page - accessible after login */}
            <Route element={<ProtectedRoute />}>
              <Route path="/seed" element={<SeedPage />} />
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard"    element={<DashboardPage />} />
                <Route path="/wallets"      element={<WalletsPage />} />
                <Route path="/team"         element={<TeamPage />} />
                <Route path="/expenses"     element={<ExpensesPage />} />
                <Route path="/reimbursements" element={<ReimbursementsPage />} />
                <Route path="/ap-invoices"  element={<APInvoicesPage />} />
                <Route path="/ar-invoices"  element={<ARInvoicesPage />} />
                <Route path="/suppliers"    element={<SuppliersPage />} />
                <Route path="/customers"    element={<CustomersPage />} />
                <Route path="/accounting"   element={<AccountingPage />} />
                <Route path="/cash-flow"    element={<CashFlowPage />} />
                <Route path="/tax-advisor"  element={<TaxAdvisorPage />} />
                <Route path="/reports"      element={<ReportsPage />} />
                <Route path="/cards"        element={<CardsPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/budgets"      element={<BudgetsPage />} />
                <Route path="/billing"      element={<BillingPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/import-data"  element={<ImportDataPage />} />
                <Route path="/admin"        element={<AdminPage />} />
                <Route path="/audit-log"    element={<AuditLogPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
