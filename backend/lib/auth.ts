import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";

/**
 * Returns the userId from Clerk session, or demo fallback if enabled.
 */
export function getRequestUserId(req: NextApiRequest): string | null {
  const isDemo = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
  if (isDemo) {
    return process.env.DEMO_USER_ID || "demo-user";
  }

  const { userId } = getAuth(req);
  return userId || null;
}

/**
 * Ensures the request is authenticated. Returns userId or sends 401.
 */
export function ensureAuthenticated(
  req: NextApiRequest,
  res: NextApiResponse
): string | null {
  const userId = getRequestUserId(req);

  if (!userId) {
    console.warn("🔒 Unauthorized access attempt");
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return userId;
}
