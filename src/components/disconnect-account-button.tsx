"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectSocialAccount } from "@/app/actions/accounts";

export default function DisconnectAccountButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Asks first, because any posts already scheduled for this account won't
  // go out until it's connected again.
  function handleClick() {
    const confirmed = window.confirm(
      `Disconnect ${accountName}? SocialBoost will no longer be able to post to it, and any posts scheduled for it will fail until you connect it again. Past posts stay in SocialBoost.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      await disconnectSocialAccount(accountId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
