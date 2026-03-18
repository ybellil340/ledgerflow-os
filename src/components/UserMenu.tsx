import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Settings,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronDown,
  Building2,
  Keyboard,
} from "lucide-react";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { organization, role } = useOrganization();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const email = user?.email ?? "";
  const initials = email
    .split("@")[0]
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || email[0]?.toUpperCase() || "U";

  const displayName = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const roleLabel =
    role === "company_admin" ? "Admin" :
    role === "accountant" ? "Accountant" :
    role === "employee" ? "Employee" : "Member";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent/60 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group"
          aria-label="User menu"
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start min-w-0">
            <span className="text-[13px] font-medium text-foreground leading-tight truncate max-w-[120px]">
              {displayName}
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight truncate max-w-[120px]">
              {organization?.name ?? "LedgerFlow"}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 hidden sm:block shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-64 p-1.5"
        align="end"
        sideOffset={8}
      >
        {/* User info header */}
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground leading-tight truncate mt-0.5">{email}</p>
            <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5 font-medium">
              {roleLabel}
            </Badge>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 py-1.5">
            Account
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
            onClick={() => navigate("/team")}
          >
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
            onClick={() => navigate("/admin")}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>Settings</span>
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
            onClick={() => navigate("/billing")}
          >
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>Billing & Plan</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
            onClick={() => navigate("/notifications")}
          >
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span>Notifications</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-3 py-1.5">
            Organisation
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
            onClick={() => navigate("/admin")}
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>Organisation settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
            onClick={() => navigate("/team")}
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span>Roles & permissions</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
          >
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <span>Keyboard shortcuts</span>
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span>Help & support</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
