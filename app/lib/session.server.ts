import { createCookieSessionStorage, redirect } from "react-router";
import { prisma } from "./prisma.server";

const sessionSecret =
  process.env.SESSION_SECRET || "gastario-dev-secret-change-me";

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

export async function createUserSession(
  userId: string,
  redirectTo: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      sessionVersion: true,
    },
  });

  if (!user) {
    return redirect("/login");
  }

  const session = await storage.getSession();

  session.set("userId", user.id);
  session.set("sessionVersion", user.sessionVersion);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function getUserId(request: Request) {
  const session = await storage.getSession(
    request.headers.get("Cookie")
  );

  const userId = session.get("userId");
  const storedSessionVersion = session.get("sessionVersion");

  if (!userId || typeof userId !== "string") {
    return null;
  }

  /*
   * Bestehende Sitzungen aus der Zeit vor sessionVersion
   * werden wie Version 0 behandelt. Dadurch bleiben sie zunächst
   * gültig, werden aber nach einem Passwortwechsel ungültig.
   */
  const sessionVersion =
    typeof storedSessionVersion === "number" &&
    Number.isInteger(storedSessionVersion)
      ? storedSessionVersion
      : 0;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      sessionVersion: true,
    },
  });

  if (!user || user.sessionVersion !== sessionVersion) {
    return null;
  }

  return user.id;
}

export async function requireUserId(request: Request) {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  return userId;
}

export async function logout(request: Request) {
  const session = await storage.getSession(
    request.headers.get("Cookie")
  );

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