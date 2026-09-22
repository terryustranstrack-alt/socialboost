import { redirect } from "next/navigation";
import Link from "next/link";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_MANAGE_BRAND } from "@/lib/rbac";

export default async function SettingsPage() {
  const { brand, memberships } = await requireActiveBrand();
  if (!hasRole(memberships, brand.brandId, CAN_MANAGE_BRAND)) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Settings — {brand.brandName}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/settings/accounts"
          className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
        >
          <h2 className="text-sm font-medium text-slate-900">Connected accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect Instagram &amp; Facebook accounts for this brand.
          </p>
        </Link>
        <Link
          href="/settings/team"
          className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
        >
          <h2 className="text-sm font-medium text-slate-900">Team &amp; roles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage who can create, approve, or view content for this brand.
          </p>
        </Link>
      </div>
    </div>
  );
}
