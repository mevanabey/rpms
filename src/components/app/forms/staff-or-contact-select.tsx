"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Party } from "@/core/types";
import type { DraftParty } from "@/lib/demo/types";
import type { StaffUser } from "@/lib/auth/staff";
import { prepareStaffPartyAction } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PartyPicker } from "./party-picker";

export function StaffOrContactSelect({
  role,
  value,
  userId,
  onChange,
  parties,
  draftParties = [],
  staff,
  clearOnModeChange = true,
  linkExistingContact = false,
}: {
  role: StaffUser["role"];
  value: string;
  userId?: string;
  onChange: (partyId: string, userId?: string) => void;
  parties: Party[];
  draftParties?: DraftParty[];
  staff: StaffUser[];
  clearOnModeChange?: boolean;
  linkExistingContact?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"staff" | "contact">(userId ? "staff" : "contact");
  const [pending, setPending] = useState(false);
  const [createdParty, setCreatedParty] = useState<Party | null>(null);
  const eligible = staff.filter((person) => person.role === role);
  const options = createdParty && !parties.some((p) => p.id === createdParty.id)
    ? [...parties, createdParty] : parties;

  const chooseStaff = async (id: string) => {
    setPending(true);
    const result = await prepareStaffPartyAction(id, role, linkExistingContact && value && !userId ? value : undefined);
    setPending(false);
    if (!result.ok) {
      toast.error("Could not link system user", { description: result.error });
      return;
    }
    setCreatedParty(result.data);
    onChange(result.data.id, id);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1" role="group" aria-label="Participant type">
        <Button type="button" size="sm" variant={mode === "staff" ? "secondary" : "ghost"}
          onClick={() => { setMode("staff"); if (clearOnModeChange) onChange("", undefined); }}>System user</Button>
        <Button type="button" size="sm" variant={mode === "contact" ? "secondary" : "ghost"}
          onClick={() => { setMode("contact"); if (clearOnModeChange) onChange("", undefined); }}>External contact</Button>
      </div>
      {mode === "staff" ? (
        <>
          <Select value={userId ?? ""} onValueChange={(id) => void chooseStaff(id)} disabled={pending}>
            <SelectTrigger aria-label={`Select ${role} system user`}><SelectValue placeholder={pending ? "Linking…" : `Select ${role} user`} /></SelectTrigger>
            <SelectContent>
              {eligible.map((person) => (
                <SelectItem key={person.id} value={person.id}>{person.name} · {person.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {eligible.length === 0 && <p className="text-xs text-muted-foreground">No active {role} users are configured.</p>}
          <p className="text-xs text-muted-foreground">This user gets access to this lease.</p>
          {linkExistingContact && value && !userId && <p className="text-xs text-muted-foreground">The selected contact will be linked to this account.</p>}
        </>
      ) : (
        <>
          <PartyPicker value={value} onChange={(id) => onChange(id, undefined)}
            parties={options} draftParties={draftParties} placeholder="Select or add a contact" />
          <p className="text-xs text-muted-foreground">Email/contact only. No app access.</p>
        </>
      )}
    </div>
  );
}
