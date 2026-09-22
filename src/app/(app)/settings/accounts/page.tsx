import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import { connectSocialAccount, toggleSocialAccount } from "@/app/actions/accounts";

export default async function ConnectedAccountsPage() {
  const { brand, memberships } = await requireActiveBrand();
  if (!hasRole(memberships, brand.brandId, CAN_MANAGE_BRAND)) redirect("/dashboard");

  const accounts = await prisma.socialAccount.findMany({
    where: { brandId: brand.brandId },
    orderBy: { platform: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Connected accounts — {brand.brandName}</h1>

      <div className="rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {a.platform} — {a.displayName}
                </p>
                <p className="text-xs text-slate-500">ID: {a.externalAccountId}</p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await toggleSocialAccount(a.id, !a.isActive);
                }}
              >
                <button
                  type="submit"
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    a.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {a.isActive ? "Active" : "Inactive"}
                </button>
              </form>
            </li>
          ))}
          {accounts.length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-500">No accounts connected yet.</li>
          )}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">Connect a new account</h2>
        <p className="mt-1 text-xs text-slate-500">
          Development Mode setup: get the Page-scoped / IG Business account ID and a
          long-lived access token from Meta Business Suite / Graph API Explorer for an
          account added as an admin or tester on your app. The token is encrypted (AES-256-GCM)
          before it&apos;s stored.
        </p>
        <form action={connectSocialAccount} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="brandId" value={brand.brandId} />
          <div>
            <label className="block text-xs font-medium text-slate-700">Platform</label>
            <select name="platform" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="LINKEDIN">LinkedIn (pending API approval)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Display name</label>
            <input name="displayName" required placeholder="e.g. TransTRACK Instagram" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Account / Page ID</label>
            <input name="externalAccountId" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Access token</label>
            <input name="accessToken" type="password" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Save connection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
