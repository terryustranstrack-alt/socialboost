import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type SessionMembership = {
  brandId: string;
  brandSlug: string;
  brandName: string;
  role: Role;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      memberships: SessionMembership[];
    };
  }
}

// We deliberately don't hook into the "next-auth/jwt" package to add our
// custom fields — doing that pulls in extra type packages we haven't
// installed and breaks the build. Defining our own token type below (used
// only inside this file) avoids that problem entirely.
type AppJWT = {
  id?: string;
  memberships?: SessionMembership[];
  [key: string]: unknown;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email & password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as AppJWT;
      if (user?.id) {
        t.id = user.id;
      }
      // Refresh memberships on every request so a role change (or a
      // newly-added brand) takes effect without forcing a re-login.
      if (t.id) {
        const memberships = await prisma.membership.findMany({
          where: { userId: t.id },
          include: { brand: true },
        });
        t.memberships = memberships.map((m) => ({
          brandId: m.brandId,
          brandSlug: m.brand.slug,
          brandName: m.brand.name,
          role: m.role,
        }));
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as AppJWT;
      if (t.id) session.user.id = t.id;
      session.user.memberships = t.memberships ?? [];
      return session;
    },
  },
});
