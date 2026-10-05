"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import type { LeaseAuditEntry } from "@/server/audit";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NotificationBell({ entries }: { entries: LeaseAuditEntry[] }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Recent lease activity"><Bell className="size-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-80 p-0">
      <div className="flex justify-between items-center border-b p-3"><span className="font-medium text-sm">Recent lease activity</span><Button asChild variant="ghost" size="sm"><Link href="/activity">View all</Link></Button></div>
      <div className="max-h-96 overflow-y-auto">
        {!entries.length && <p className="p-4 text-sm text-muted-foreground">No changes yet.</p>}
        {entries.map((entry) => <Link key={entry.id} href={`/activity/${entry.id}`} className="block border-b p-3 hover:bg-muted">
          <p className="text-sm font-medium">{entry.action}</p><p className="text-xs text-muted-foreground">{entry.actorName} · {new Date(entry.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}</p>
        </Link>)}
      </div>
    </DropdownMenuContent>
  </DropdownMenu>;
}
