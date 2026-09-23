import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import { connectSocialAccount, toggleSocialAccount } from "@/app/actions/accounts";

export default async function ConnectedAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { brand, memberships } = await requireActiveBrand();
  if (!hasRole(memberships, brand.brandId, CAN_MANAGE_BRAND)) redirect("/dashboard");

  const { connected, error } = await searchParams;

  const accounts = await prisma.socialAccount.findMany({
    where: { brandId: brand.brandId },
    orderBy: { platform: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Connected accounts — {brand.brandName}</h1>

      {connected && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Connected {connected} Facebook Page{connected === "1" ? "" : "s"} (and any linked
          Instagram accounts) to {brand.brandName}.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t connect: {connectErrorMessage(error)}
        </p>
      )}

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
        <h2 className="text-sm font-medium text-slate-900">Connect Instagram or Facebook</h2>
        <p className="mt-1 text-xs text-slate-500">
          Log in with the Facebook account that manages {brand.brandName}&apos;s Page(s), pick
          which ones to allow, and we&apos;ll connect them (and any linked Instagram account)
          automatically — no copying IDs or access tokens by hand.
        </p>
        <a
          href={`/api/auth/meta/start?brandId=${brand.brandId}`}
          className="mt-3 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Connect with Facebook
        </a>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-medium text-slate-900">Or add manually (advanced)</h2>
        <p className="mt-1 text-xs text-slate-500">
          For Development Mode testing without going through the button above: get the
          Page-scoped / IG Business account ID and a long-lived access token from Meta
          Business Suite / Graph API Explorer for an account added as an admin or tester on
          your app. The token is encrypted (AES-256-GCM) before it&apos;s stored.
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

// Turns an error code from the OAuth callback into a plain-language
// message — the people using this page aren't engineers.
function connectErrorMessage(code: string): string {
  switch (code) {
    case "forbidden":
      return "Only an Admin can connect accounts for this brand.";
    case "invalid_request":
      return "The connection attempt expired or wasn't recognized — please try again.";
    case "not_signed_in":
      return "You were signed out partway through — please log in and try again.";
    case "meta_error":
      return "Facebook couldn't finish the connection — please try again.";
    default:
      return "Something went wrong.";
  }
}
