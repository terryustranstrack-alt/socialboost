import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import { addTeamMember, removeTeamMember } from "@/app/actions/team";

export default async function TeamPage() {
  const { brand, memberships } = await requireActiveBrand();
  if (!hasRole(memberships, brand.brandId, CAN_MANAGE_BRAND)) redirect("/dashboard");

  const brandMemberships = await prisma.membership.findMany({
    where: { brandId: brand.brandId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Team — {brand.brandName}</h1>

      <div className="rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {brandMemberships.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{m.user.name}</p>
                <p className="text-xs text-slate-500">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {m.role}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await removeTeamMember(m.id);
                  }}
                >
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">Add a team member</h2>
        <p className="mt-1 text-xs text-slate-500">
          Approval is single-level (PRD 6.3) — assign the Approver role to exactly one
          person per brand to keep that workflow simple.
        </p>
        <form action={addTeamMember} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="brandId" value={brand.brandId} />
          <div>
            <label className="block text-xs font-medium text-slate-700">Name</label>
            <input name="name" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Email</label>
            <input name="email" type="email" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Role</label>
            <select name="role" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="VIEWER">Viewer</option>
              <option value="CREATOR">Creator</option>
              <option value="APPROVER">Approver</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Initial password (new users only)
            </label>
            <input name="password" type="password" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Add / update member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
