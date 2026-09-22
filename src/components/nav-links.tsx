"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const linkClass = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

export default function NavLinks({
  showApprovals,
  showSettings,
}: {
  showApprovals: boolean;
  showSettings: boolean;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/calendar", label: "Calendar" },
    { href: "/posts", label: "Posts" },
    ...(showApprovals ? [{ href: "/approvals", label: "Approvals" }] : []),
    ...(showSettings ? [{ href: "/settings", label: "Settings" }] : []),
  ];

  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={linkClass(pathname.startsWith(link.href))}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
