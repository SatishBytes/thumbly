import type { NextApiRequest, NextApiResponse } from "next";
import { createRouter } from "next-connect";
import multer from "multer";
import { supabase } from "../../lib/supabaseClient";
import { nanoid } from "nanoid";
import Cors from "cors";
import { initMiddleware } from "../../lib/init-middleware";
import { getRequestUserId } from "../../lib/auth"; // 🔐 Centralized auth

// 1️⃣ CORS setup
const cors = initMiddleware(
  Cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",
    methods: ["POST", "OPTIONS"],
  })
);

// 2️⃣ Multer setup (memory storage + 5MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 3️⃣ Router setup
const router = createRouter<NextApiRequest, NextApiResponse>();
export const config = { api: { bodyParser: false } };

// 4️⃣ CORS + preflight
router.use(async (req, res, next) => {
  await cors(req, res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});

// 5️⃣ Multer middleware
router.use((req, res, next) => {
  upload.single("thumbnail")(req as any, res as any, next as any);
});

// 6️⃣ POST handler with Clerk auth
router.post(async (req, res) => {
  try {
    // 🔐 Auth (supports demo mode)
    const userId = getRequestUserId(req);
    if (!userId) {
      console.warn("🔒 Unauthorized upload attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      console.warn("⚠️ No file received in request");
      return res.status(400).json({ error: "No file uploaded" });
    }

    // 🧠 Generate filename
    const id = nanoid();
    const ext = file.originalname.includes(".")
      ? file.originalname.split(".").pop()
      : "jpg";
    const fileName = `${userId}/${id}.${ext}`; // 🔐 Prefix with userId
    const fileBuffer = file.buffer;
    const contentType = file.mimetype || "image/jpeg";

    // 🗂️ Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from("thumbnails")
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Supabase upload failed:", uploadError.message);
      return res.status(500).json({ error: `Supabase upload failed: ${uploadError.message}` });
    }

    // 🌐 Get public URL
    const { data: publicData } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(fileName);

    if (!publicData?.publicUrl) {
      console.error("❌ Failed to get public URL");
      return res.status(500).json({ error: "Failed to get public URL" });
    }

    console.log("✅ Uploaded:", fileName);
    return res.status(200).json({
      name: fileName,
      url: publicData.publicUrl,
      source: "manual",
      userId, // 🔐 Include userId in response
    });
  } catch (err: any) {
    console.error("❌ Unexpected error:", err.message);
    return res.status(500).json({ error: `Unexpected error: ${err.message}` });
  }
});

// 7️⃣ Error and fallback handlers
export default router.handler({
  onError(err, _req, res) {
    console.error("❌ Route error:", err);
    (res as NextApiResponse).status(500).json({
      error: (err as Error).message || "Internal server error",
    });
  },
  onNoMatch(_req, res) {
    (res as NextApiResponse).status(405).json({ error: "Method not allowed" });
  },
});
