"use client";

import { useSubmission } from "@/hooks/use-submission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LeaseAuditSearch({ search = "" }: { search?: string }) {
  const { pending, run, retain } = useSubmission();
  return <form className="flex gap-2" action="/activity" aria-busy={pending} onSubmit={(event) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("search")?.toString() ?? "";
    void run(() => { retain(); window.location.assign(`/activity?${new URLSearchParams({ search: query })}`); });
  }}>
    <Input name="search" disabled={pending} defaultValue={search} placeholder="Search by action, person, or record type" aria-label="Search lease history" />
    <Button type="submit" disabled={pending} variant="outline">{pending ? "Searching…" : "Search"}</Button>
  </form>;
}
