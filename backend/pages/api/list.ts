import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabaseClient";
import { getRequestUserId } from "../../lib/auth"; // 🔐 Centralized auth

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔐 Auth (supports demo mode)
  const userId = getRequestUserId(req);
  if (!userId) {
    console.warn("🔒 Unauthorized gallery access");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 📁 List files inside user's folder
  const { data, error } = await supabase.storage
    .from("thumbnails")
    .list(userId, { limit: 100 }); // 👈 Only list files under userId folder

  if (error) {
    console.error("❌ Supabase list failed:", error.message);
    return res.status(500).json({ error: error.message });
  }

  const files = data.map((file) => {
    const fullPath = `${userId}/${file.name}`;
    const { data: { publicUrl } } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(fullPath); // 👈 Construct full path
    return { name: fullPath, url: publicUrl };
  });

  return res.status(200).json({ files });
}
