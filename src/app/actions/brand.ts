"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE } from "@/lib/active-brand";

export async function setActiveBrand(formData: FormData) {
  const brandId = String(formData.get("brandId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/dashboard");
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(returnTo);
}
