"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function AdminReportsPage() {
  const handleExcel = async () => {
    toast.loading("Generating report...");
    const res = await fetch("/api/export/excel");
    if (!res.ok) { toast.dismiss(); toast.error("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "AtomQuest_Goals.xlsx"; a.click();
    URL.revokeObjectURL(url);
    toast.dismiss(); toast.success("Report downloaded!");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Report Center</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center"><FileSpreadsheet className="w-6 h-6 text-green-600" /></div>
            <div className="flex-1"><p className="font-semibold">Goals Report (Excel)</p><p className="text-sm text-slate-500">All goals with check-in scores</p></div>
            <Button onClick={handleExcel}><Download className="w-4 h-4 mr-1" /> Export</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
