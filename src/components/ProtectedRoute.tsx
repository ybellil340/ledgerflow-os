import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

export default function ProtectedRoute() {
  const { user, loading: authLoading } = useAuth();
  const { orgId, isLoading: orgLoading } = useOrganization();

  if (authLoading || orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!orgId) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
