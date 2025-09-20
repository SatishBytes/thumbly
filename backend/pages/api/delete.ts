import { type NextApiRequest, type NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getRequestUserId } from "../../lib/auth"; // 🔐 Centralized auth

// 🔐 Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 🔐 Auth (supports demo mode)
  const userId = getRequestUserId(req);
  if (!userId) {
    console.warn("🔒 Unauthorized delete attempt");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { name } = req.query;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'name' parameter" });
  }

  // 🔐 Ensure user is deleting their own file
  if (!name.startsWith(`${userId}/`)) {
    console.warn("🚫 Attempt to delete file not owned by user:", name);
    return res.status(403).json({ error: "Forbidden: Cannot delete other users' files" });
  }

  try {
    const { error } = await supabase.storage
      .from("thumbnails")
      .remove([name]);

    if (error) {
      console.error("❌ Supabase delete failed:", error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log("✅ Deleted:", name);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("❌ Unexpected delete error:", err.message);
    return res.status(500).json({ error: err.message || "Delete failed" });
  }
}
