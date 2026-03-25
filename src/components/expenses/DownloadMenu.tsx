import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadCsv, downloadPdf } from "@/lib/download";
import type { Expense } from "@/types";

interface Props {
  expenses: Expense[];
}

export function DownloadMenu({ expenses }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadCsv(expenses)} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadPdf(expenses)} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-red-500" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
