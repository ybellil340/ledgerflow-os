import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, ArrowUpDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  value: string;
  count?: number;
}

interface DataPageHeaderProps {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onDownload?: () => void;
  actions?: ReactNode;
}

export function DataPageHeader({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  onDownload,
  actions,
}: DataPageHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 border-b border-border -mx-6 lg:-mx-8 px-6 lg:px-8">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onTabChange?.(tab.value)}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === tab.value
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.value && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      {(onSearchChange || onDownload) && (
        <div className="flex items-center gap-3">
          {onSearchChange && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9 bg-card border-border"
              />
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-xs">Filter</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="text-xs">Sort</span>
            </Button>
            {onDownload && (
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground gap-1.5" onClick={onDownload}>
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">Download</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable table wrapper with consistent styling
interface DataTableProps {
  headers: string[];
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  hasCheckbox?: boolean;
  allChecked?: boolean;
  onCheckAll?: (checked: boolean) => void;
}

export function DataTable({
  headers,
  isLoading,
  isEmpty,
  emptyMessage = "No data found.",
  children,
  hasCheckbox,
  allChecked,
  onCheckAll,
}: DataTableProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border">
        <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bg-card rounded-lg border border-border">
        <div className="p-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {hasCheckbox && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => onCheckAll?.(e.target.checked)}
                    className="rounded border-border"
                  />
                </th>
              )}
              {headers.map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-medium text-muted-foreground text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// Status badge component
const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/10 text-warning",
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  reimbursed: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  active: "bg-success/10 text-success",
  frozen: "bg-warning/10 text-warning",
  inactive: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full capitalize",
      statusStyles[status] || "bg-muted text-muted-foreground"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        status === "active" || status === "approved" || status === "paid" || status === "reimbursed" ? "bg-success" :
        status === "submitted" || status === "pending" || status === "frozen" ? "bg-warning" :
        status === "rejected" || status === "overdue" ? "bg-destructive" :
        "bg-muted-foreground"
      )} />
      {status}
    </span>
  );
}
