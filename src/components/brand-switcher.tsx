"use client";

import type { SessionMembership } from "@/auth";
import { setActiveBrand } from "@/app/actions/brand";

export default function BrandSwitcher({
  memberships,
  activeBrandId,
  returnTo,
}: {
  memberships: SessionMembership[];
  activeBrandId: string;
  returnTo: string;
}) {
  if (memberships.length <= 1) {
    return (
      <span className="text-sm font-medium text-slate-700">
        {memberships[0]?.brandName}
      </span>
    );
  }

  return (
    <form action={setActiveBrand} className="flex items-center gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <select
        name="brandId"
        defaultValue={activeBrandId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
      >
        {memberships.map((m) => (
          <option key={m.brandId} value={m.brandId}>
            {m.brandName}
          </option>
        ))}
      </select>
    </form>
  );
}
