"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Lease, LeasePartyRole, Party, PartyRole } from "@/core/types";
import type { StaffUser } from "@/lib/auth/staff";
import { StaffOrContactSelect } from "@/components/app/forms/staff-or-contact-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateLeaseAction } from "@/server/actions";

const POSITIONS: { role: PartyRole; label: string; userRole: StaffUser["role"] }[] = [
  { role: "advisor", label: "Advisor", userRole: "advisor" },
  { role: "lessor_lawyer", label: "Landlord's lawyer", userRole: "lawyer" },
  { role: "lessee_lawyer", label: "Capital Trust lawyer", userRole: "lawyer" },
  { role: "accountant_handler", label: "Accountant / handler", userRole: "accountant" },
];

export function LeaseParticipants({ lease, parties, staff, canEdit }: {
  lease: Lease;
  parties: Party[];
  staff: StaffUser[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState<LeasePartyRole[]>(lease.additionalRoles ?? []);
  const [saving, setSaving] = useState(false);
  const byParty = new Map(parties.map((party) => [party.id, party]));
  const byUser = new Map(staff.map((user) => [user.id, user]));

  async function replace(role: PartyRole, previous: LeasePartyRole | undefined, partyId: string, userId?: string) {
    const next = roles.filter((assignment) => assignment !== previous);
    if (partyId) {
      if (next.some((item) => item.role === role && item.partyId === partyId)) {
        toast.error("This contact is already assigned in that role.");
        return;
      }
      next.push({ partyId, role, userId });
    }
    setSaving(true);
    const result = await updateLeaseAction(lease.id, { additionalRoles: next });
    setSaving(false);
    if (!result.ok) {
      toast.error("Could not update participant", { description: result.error });
      return;
    }
    setRoles(result.data.additionalRoles ?? []);
    toast.success("Lease participants updated");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team & contacts</CardTitle>
        <CardDescription>System users get access only to their assigned leases. External contacts receive correspondence without app access.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        {POSITIONS.map((position) => {
          const assigned = roles.filter((item) => item.role === position.role);
          return (
            <div key={position.role} className="space-y-2 rounded-md border p-3">
              <div className="font-medium text-sm">{position.label}</div>
              {assigned.length === 0 && <p className="text-xs text-muted-foreground">Not assigned</p>}
              {assigned.map((person) => {
                const party = byParty.get(person.partyId);
                const user = person.userId ? byUser.get(person.userId) : undefined;
                return <div key={`${person.partyId}:${person.role}`} className="space-y-2 border-b pb-2">
                  <p className="text-xs text-muted-foreground">
                    {party?.displayName ?? "Contact"} · {person.userId ? `System user${user ? ` (${user.email})` : ""}` : "External contact"}
                  </p>
                  {canEdit && !person.userId && <div className={saving ? "pointer-events-none opacity-50" : ""}>
                    <StaffOrContactSelect role={position.userRole} value={person.partyId}
                      onChange={(partyId, userId) => void replace(position.role, person, partyId, userId)}
                      parties={parties} staff={staff} clearOnModeChange={false} linkExistingContact />
                  </div>}
                  {canEdit && <Button type="button" variant="ghost" size="sm" disabled={saving}
                    onClick={() => void replace(position.role, person, "")}>Remove</Button>}
                </div>;
              })}
              {canEdit && (
                <>
                  <p className="text-xs font-medium">Add {position.label.toLowerCase()}</p>
                  <div className={saving ? "pointer-events-none opacity-50" : ""}>
                    <StaffOrContactSelect role={position.userRole} value=""
                      onChange={(partyId, userId) => void replace(position.role, undefined, partyId, userId)}
                      parties={parties} staff={staff} clearOnModeChange={false} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
