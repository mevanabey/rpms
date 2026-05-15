"use client";

import Link from "next/link";

import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";

import { ActivityFeed } from "@/components/app/activity-feed";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemoStore } from "@/lib/demo/store";
import { useVisibleActivities } from "@/lib/demo/use-store";

export function NotificationBell() {
  const activities = useVisibleActivities();
  const unreadCount = activities.reduce((acc, a) => acc + (a.acked ? 0 : 1), 0);
  const ackAll = useDemoStore((s) => s.ackAllActivities);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Notifications · ${unreadCount} unread`}
          data-onborda="notification-bell"
          className="relative"
        >
          <Bell className="size-4" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="-top-0.5 -right-0.5 absolute flex size-4 items-center justify-center rounded-full bg-rose-500 font-medium text-[10px] text-white tabular-nums shadow"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div>
            <div className="text-sm font-medium">Activity</div>
            <div className="text-muted-foreground text-xs">
              {unreadCount === 0 ? "All caught up" : `${unreadCount} new`}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={ackAll}>
                Mark all read
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href="/activity">View all</Link>
            </Button>
          </div>
        </div>
        <div className="max-h-[440px] overflow-y-auto">
          <ActivityFeed activities={activities.slice(0, 10)} compact />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
