import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveBrand } from "@/lib/active-brand";
import { hasRole, CAN_APPROVE, CAN_MANAGE_BRAND } from "@/lib/rbac";
import BrandSwitcher from "@/components/brand-switcher";
import NavLinks from "@/components/nav-links";
import SignOutButton from "@/components/sign-out-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const memberships = session.user.memberships;

  if (memberships.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">No brand access yet</h1>
          <p className="mt-2 text-sm text-slate-500">
            Ask a TransTRACK admin to add you to a brand (transtrack.co or
            transtrack.academy) before you can use SocialBoost.
          </p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const activeBrand = await getActiveBrand(memberships);
  const showApprovals = hasRole(memberships, activeBrand!.brandId, CAN_APPROVE);
  const showSettings = hasRole(memberships, activeBrand!.brandId, CAN_MANAGE_BRAND);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-base font-semibold text-slate-900">SocialBoost</span>
            <NavLinks showApprovals={showApprovals} showSettings={showSettings} />
          </div>
          <div className="flex items-center gap-4">
            <BrandSwitcher
              memberships={memberships}
              activeBrandId={activeBrand!.brandId}
              returnTo="/dashboard"
            />
            <span className="text-sm text-slate-500">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
