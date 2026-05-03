import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { findMembership } from "@/lib/firebase-data";
import type { AdminRole, MembershipRow } from "@/lib/firebase-types";

export const ADMIN_READ_ROLES = ["owner", "admin", "staff"] as const;
export const ADMIN_WRITE_ROLES = ["owner", "admin"] as const;

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

function getSuperAdminEmails(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().has(email.toLowerCase());
}

function isSuperAdminUser(user: AuthenticatedUser): boolean {
  return isSuperAdminEmail(user.email);
}

export type TenantMembershipResult =
  | {
      ok: true;
      user: AuthenticatedUser;
      membership: MembershipRow;
    }
  | {
      ok: false;
      status: 401 | 403;
      message: string;
    };

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  if (!cookieHeader) {
    return new Map();
  }

  const cookieMap = new Map<string, string>();
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [rawName, ...rawValueParts] = part.split("=");
    const name = rawName?.trim();
    if (!name) continue;

    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) continue;

    const unquoted = rawValue.replace(/^"|"$/g, "");
    cookieMap.set(name, unquoted);
  }

  return cookieMap;
}

function getAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));

  const cookieToken =
    cookies.get("firebase-id-token") ?? cookies.get("__session") ?? cookies.get("token") ?? cookies.get("auth_token");

  if (!cookieToken) {
    return null;
  }

  return decodeURIComponent(cookieToken).trim() || null;
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  const accessToken = getAccessTokenFromRequest(request);
  if (!accessToken) {
    return null;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(accessToken, true);
    return {
      id: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : null,
    };
  } catch {
    return null;
  }
}

export async function requireTenantMembership(
  request: Request,
  tenantId: string,
  allowedRoles: readonly AdminRole[],
): Promise<TenantMembershipResult> {
  const user = await getAuthenticatedUserFromRequest(request);

  if (!user) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: sign in required.",
    };
  }

  if (isSuperAdminUser(user)) {
    return {
      ok: true,
      user,
      membership: {
        tenant_id: tenantId,
        user_id: user.id,
        role: "owner",
      },
    };
  }

  const membership = await findMembership(tenantId, user.id, user.email);

  if (!membership) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden: you are not a member of this tenant.",
    };
  }

  if (!allowedRoles.includes(membership.role)) {
    return {
      ok: false,
      status: 403,
      message: `Forbidden: ${membership.role} role cannot access this resource.`,
    };
  }

  return {
    ok: true,
    user,
    membership,
  };
}
