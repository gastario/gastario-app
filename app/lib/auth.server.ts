import bcrypt from "bcryptjs";
import { createCookieSessionStorage, redirect } from "react-router";
import { prisma } from "./db.server";

const sessionSecret = process.env.SESSION_SECRET || "gastario-dev-secret-change-me";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "gastario_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  },
});

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getUserId(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");

  return typeof userId === "string" ? userId : null;
}

export async function requireUser(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenants: {
        include: {
          tenant: true,
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw redirect("/login");
  }

  return user;
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));

  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
