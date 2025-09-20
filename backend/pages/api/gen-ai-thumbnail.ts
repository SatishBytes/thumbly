import { NextApiRequest, NextApiResponse } from "next";
import { nanoid } from "nanoid";
import { createClient } from "@supabase/supabase-js";
import { getRequestUserId } from "../../lib/auth"; // 🔐 Centralized auth

// 🔐 Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// 🔧 Gemini API call for text generation
async function generateGeminiText(prompt: string): Promise<string> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  const data = await response.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!reply) {
    console.error("⚠️ Gemini returned empty response:", data);
    throw new Error("No response from Gemini");
  }

  return reply;
}

// 🚀 API route handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  // 🔐 Auth (supports demo mode)
  const userId = getRequestUserId(req);
  if (!userId) {
    console.warn("🔒 Unauthorized Gemini access");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { prompt, imageBufferBase64 } = req.body as {
    prompt?: string;
    imageBufferBase64?: string;
  };

  if (!prompt || !imageBufferBase64) {
    return res.status(400).json({ error: "Missing prompt or image buffer" });
  }

  try {
    // 🧠 Get Gemini caption or style suggestion
    const geminiText = await generateGeminiText(prompt);

    // 🖼️ Convert base64 to Buffer
    const imageBuffer = Buffer.from(imageBufferBase64, "base64");

    // 🗂️ Upload to Supabase with userId prefix
    const fileName = `${userId}/${nanoid()}-gemini.jpg`;
    const uploadResult = await supabase.storage
      .from("thumbnails")
      .upload(fileName, imageBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadResult.error) throw uploadResult.error;

    const { data } = supabase.storage.from("thumbnails").getPublicUrl(fileName);
    const publicUrl = data?.publicUrl;

    if (!publicUrl) throw new Error("Failed to get public URL from Supabase");

    console.log("✅ Uploaded Gemini thumbnail:", fileName);
    console.log("🌐 Public URL:", publicUrl);

    return res.status(200).json({
      name: fileName,
      url: publicUrl,
      caption: geminiText,
      source: "gemini",
      userId, // 🔐 Include userId in response
    });

  } catch (err: any) {
    console.error("✖ Gemini flow failed:", err);
    return res.status(500).json({ error: err.message || "Gemini flow failed" });
  }
}
