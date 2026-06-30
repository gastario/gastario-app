import { createCookieSessionStorage, redirect } from "react-router";
import { prisma } from "./prisma.server";

const sessionSecret = process.env.SESSION_SECRET || "gastario-dev-secret-change-me";

const storage = createCookieSessionStorage({
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

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function getUserId(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");

  if (!userId || typeof userId !== "string") {
    return null;
  }

  return userId;
}

export async function requireUserId(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  return userId;
}

export async function logout(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));

  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

export async function requireSuperAdmin(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
    },
  });

  if (!user || user.platformRole !== "SUPER_ADMIN") {
    throw redirect("/login");
  }

  return user;
}