import { type ChangeEvent, useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence, type Variants, useReducedMotion } from "framer-motion"; // ✅ Framer Motion import
import { useAuth, SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";


// ✅ Resize helper to avoid 413 error
const resizeImageToBase64 = async (url: string, maxSize = 512): Promise<string> => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement("canvas");
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

  const base64 = canvas.toDataURL("image/jpeg", 0.8);
  return base64.split(",")[1];
};

// ✅ Gemini retry helper
const retryGemini = async (
  base64: string,
  prompt: string,
  retries = 3
): Promise<{ name: string; url: string; caption?: string; source?: string }> => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post("/api/gen-ai-thumbnail", {
        imageBufferBase64: base64,
        prompt,
      });
      return res.data;
    } catch (err: any) {
      const isOverloaded =
        axios.isAxiosError(err) &&
        err.response?.status === 503 &&
        err.response?.data?.error?.status === "UNAVAILABLE";

      if (isOverloaded && i < retries - 1) {
        console.warn(`⚠️ Gemini overloaded, retrying... (${i + 1})`);
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Gemini failed after retries");
};

export default function ThumbnailUploader() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const shouldReduceMotion = useReducedMotion();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [uploadedUrl, setUploadedUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "gemini" | "manual">("all");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [gallery, setGallery] = useState<
    { name: string; url: string; caption?: string; source?: string }[]
  >([]);
  const [prompt, setPrompt] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; type: "success" | "error" }>({ open: false, message: "", type: "success" });
  const [lightbox, setLightbox] = useState<{
    open: boolean;
    name?: string;
    url?: string;
    caption?: string;
    source?: string;
  }>({ open: false });

  // 🎬 Motion variants
  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  const scaleIn: Variants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: shouldReduceMotion ? 0 : 0.35 } },
    exit: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.96, transition: { duration: shouldReduceMotion ? 0 : 0.2 } },
  };

  

  // ✅ Upload Handlers
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : "");
    setUploadedUrl("");
    setError("");
    setPrompt("");
  };

  useEffect(() => {
    // Set axios default Authorization header when a Clerk token is available
    let mounted = true;
    (async () => {
      try {
        const token = await getToken();
        if (mounted && token) {
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // ignore; user may be signed out
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  useEffect(() => {
    let mounted = true;
    setIsFetching(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/list", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json();
        if (!mounted) return;
        setGallery(data.files || []);
      } catch {
        if (!mounted) return;
        setGallery([]);
      } finally {
        if (!mounted) return;
        setIsFetching(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [uploadedUrl]);

  useEffect(() => {
    if (!toast.open) return;
    const id = setTimeout(() => {
      setToast((t) => ({ ...t, open: false }));
    }, 1800);
    return () => clearTimeout(id);
  }, [toast.open]);

  const onUpload = async () => {
    if (!file) {
      setError("No file selected");
      return;
    }

    setLoading(true);
    setError("");
    setUploadProgress(0);

    const form = new FormData();
    form.append("thumbnail", file);

    try {
      const token = await getToken();
      const res = await axios.post("/api/upload", form, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(percent);
        },
      });
      setUploadedUrl(res.data.url);
      setToast({ open: true, message: "Upload successful!", type: "success" });
      setGallery((prev) => [
        {
          name: res.data.name,
          url: res.data.url,
          source: res.data.source || "manual",
        },
        ...prev,
      ]);
    } catch (e: any) {
      setToast({ open: true, message: axios.isAxiosError(e) ? (e.response?.data?.error || e.message) : "Upload failed", type: "error" });
      setError(
        axios.isAxiosError(e)
          ? e.response?.data?.error || e.message
          : "Upload failed"
      );
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    setFile(dropped);
    setPreview(URL.createObjectURL(dropped));
    setUploadedUrl("");
    setError("");
    setPrompt("");
  };

  const handleDelete = async (name: string) => {
    const existing = gallery.find((file) => file.name === name);
    if (!existing) return;

    // Optimistic UI update
    setGallery((prev) => prev.filter((file) => file.name !== name));
    try {
      const token = await getToken();
      const res = await fetch(`/api/delete?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const result = await res.json();
      if (!result.success) {
        // Revert on failure
        setGallery((prev) => [existing, ...prev]);
        setToast({ open: true, message: result.error || "Delete failed", type: "error" });
        return;
      }
      setToast({ open: true, message: "Deleted", type: "success" });
    } catch (e) {
      setGallery((prev) => [existing, ...prev]);
      setToast({ open: true, message: "Delete error", type: "error" });
    }
  };

  const generateAIThumbnail = async () => {
    if (!uploadedUrl || !prompt) return;
    setLoading(true);
    setError("");

    try {
      const base64 = await resizeImageToBase64(uploadedUrl);
      const data = await retryGemini(base64, prompt);
      setGallery((prev) => [
        { ...data, source: data.source || "gemini" },
        ...prev,
      ]);
      setPrompt("");
      setUploadedUrl("");
    } catch (e: any) {
      console.error("❌ Gemini error:", e);
      setError(
        axios.isAxiosError(e)
          ? e.response?.data?.error || e.message
          : "AI generation failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // 🔷 Return JSX
return (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: theme === "light" ? "#f5f7fa" : "#121212",
      color: theme === "light" ? "#000" : "#fff",
      transition: "background 0.3s ease, color 0.3s ease",
    }}
  >
    {/* 🔷 Header */}
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: theme === "light" ? "rgba(255,255,255,0.9)" : "rgba(30,30,30,0.9)",
        backdropFilter: "blur(6px)",
        borderBottom: theme === "light" ? "1px solid #eef0f3" : "1px solid #2a2a2a",
        boxShadow: theme === "light" ? "0 2px 8px rgba(0,0,0,0.06)" : "0 2px 10px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Logo */}
        <motion.div whileHover={{ scale: 1.03 }} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <img src="/logo.svg" alt="GenThumbAI" style={{ height: 32 }} />
          <span style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: 0.2 }}>GenThumbAI</span>
        </motion.div>

        {/* Nav */}
        <nav style={{ display: "flex", gap: "1.5rem" }}>
          {["Upload", "Gallery", "About"].map((nav) => (
            <motion.a
              key={nav}
              href={"#" + nav.toLowerCase()}
              onClick={(e) => {
                e.preventDefault();
                const el = document.querySelector("#" + nav.toLowerCase());
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              whileHover={{ scale: 1.06, color: "#0070f3" }}
              style={{ textDecoration: "none", color: theme === "light" ? "#333" : "#ddd", fontWeight: 500 }}
            >
              {nav}
            </motion.a>
          ))}
        </nav>

        {/* Right: Theme + Auth */}
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "1.2rem",
              cursor: "pointer",
            }}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </motion.button>
          <SignedOut>
            <SignInButton mode="redirect">
              <motion.button
                whileHover={{ scale: 1.05 }}
                style={{
                  background: "#0070f3",
                  border: "none",
                  padding: "6px 12px",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Login
              </motion.button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </motion.header>

    {/* 🔷 Main */}
    <main style={{ flex: 1, padding: "2rem 0" }}>
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "1.25rem 1.5rem 1.75rem",
          background: theme === "light" ? "#ffffff" : "#1b1b1b",
          borderRadius: 16,
          boxShadow: theme === "light"
            ? "0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)"
            : "0 12px 28px rgba(0,0,0,0.45)",
          border: theme === "light" ? "1px solid #eef0f3" : "1px solid #2a2a2a",
        }}
      >
        <SignedIn>
          <p style={{ textAlign: "right", fontSize: "0.9rem", color: theme === "light" ? "#555" : "#ccc" }}>
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""} 👋
          </p>
        </SignedIn>

        {/* Upload */}
        <section id="upload" style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: 12 }}>Upload & Preview</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: preview ? "1fr 1fr" : "1fr",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div>
              <motion.label
                htmlFor="file-input"
                style={{
                  display: "block",
                  padding: "18px 16px",
                  border: isDragging
                    ? "2px dashed #0070f3"
                    : (theme === "light" ? "2px dashed #d9dee6" : "2px dashed #3a3a3a"),
                  borderRadius: 12,
                  background: isDragging
                    ? (theme === "light" ? "#eef6ff" : "#0b1b2e")
                    : (theme === "light" ? "#fafbfc" : "#121212"),
                  cursor: "pointer",
                  textAlign: "center",
                  boxShadow: isDragging ? "0 10px 20px rgba(0,112,243,0.25)" : (theme === "light" ? "0 4px 10px rgba(0,0,0,0.05)" : "0 6px 12px rgba(0,0,0,0.35)"),
                }}
                initial={{ scale: 1 }}
                animate={{ scale: isDragging ? 1.02 : 1 }}
                transition={{ duration: 0.2 }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Click to choose an image</div>
                <div style={{ fontSize: 12, color: theme === "light" ? "#6b7280" : "#a3a3a3" }}>
                  PNG, JPG, GIF up to 10MB
                </div>
              </motion.label>
              <input id="file-input" type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  onClick={onUpload}
                  disabled={!file || loading}
                  style={{
                    background: !file || loading ? "#a5c8fb" : "#0070f3",
                    color: "#fff",
                    border: "none",
                    padding: "10px 16px",
                    borderRadius: 8,
                    cursor: !file || loading ? "not-allowed" : "pointer",
                    boxShadow: "0 6px 14px rgba(0,112,243,0.25)",
                    transition: "transform 0.1s ease",
                  }}
                >
                  {loading ? "Uploading…" : "Upload"}
                </button>
                {loading && (
                  <div style={{ flex: 1, alignSelf: "center" }}>
                    <div style={{ height: 8, background: theme === "light" ? "#e5e7eb" : "#2a2a2a", borderRadius: 999 }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: 8, background: "#0070f3", borderRadius: 999 }}
                      />
                    </div>
                  </div>
                )}
                {error && <span style={{ color: "#e11d48", alignSelf: "center" }}>Error: {error}</span>}
              </div>
            </div>

            <AnimatePresence>
              {preview && (
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{
                    margin: "0.25rem 0",
                    width: "100%",
                    aspectRatio: "1/1",
                    border: theme === "light" ? "1px solid #e5e7eb" : "1px solid #2e2e2e",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: theme === "light" ? "#f8fafc" : "#0f0f0f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <motion.img
                    src={preview}
                    alt="preview"
                    initial={{ scale: 1.02, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* AI Prompt */}
        {uploadedUrl && (
          <section style={{ marginBottom: "2rem" }}>
            <h4 style={{ marginBottom: 12 }}>Saved Thumbnail</h4>
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "start" }}>
              <div
                style={{
                  width: 220,
                  aspectRatio: "1/1",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: theme === "light" ? "1px solid #e5e7eb" : "1px solid #2e2e2e",
                }}
              >
                <motion.img
                  src={uploadedUrl}
                  alt="uploaded thumbnail"
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div>
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe AI transformation..."
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: theme === "light" ? "1px solid #d1d5db" : "1px solid #333",
                    background: theme === "light" ? "#fff" : "#111",
                    color: "inherit",
                  }}
                />
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={generateAIThumbnail}
                    disabled={!prompt}
                    style={{
                      background: !prompt ? "#a5c8fb" : "#0070f3",
                      color: "#fff",
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: 8,
                      cursor: !prompt ? "not-allowed" : "pointer",
                      boxShadow: "0 6px 14px rgba(0,112,243,0.25)",
                    }}
                  >
                    Generate AI Thumbnail
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Filter */}
        <section style={{ textAlign: "center", marginBottom: "1rem" }}>
          {["all", "gemini", "manual"].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type as any)}
              style={{
                marginRight: 8,
                padding: "8px 14px",
                background: filter === type ? "#0070f3" : (theme === "light" ? "#eef2f7" : "#242424"),
                color: filter === type ? "#fff" : (theme === "light" ? "#1f2937" : "#e5e7eb"),
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {type}
            </button>
          ))}
        </section>

        {/* Empty state */}
        {!isFetching && gallery.filter((g) => (filter === "all" ? true : g.source === filter)).length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{ textAlign: "center", color: theme === "light" ? "#6b7280" : "#a3a3a3", marginBottom: 24 }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>🖼️</div>
            <div>No thumbnails yet. Upload an image to get started.</div>
          </motion.div>
        )}

        {/* Undo removed: delete is immediate */}

        {/* Gallery */}
        {gallery.length > 0 && (
          <section id="gallery">
            <h3 style={{ marginBottom: 12 }}>📚 Gallery</h3>
            {isFetching && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20, marginBottom: 16 }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} style={{ padding: 10 }}>
                    <div style={{ width: "100%", aspectRatio: "1/1", background: theme === "light" ? "#eef2f7" : "#242424", borderRadius: 12 }} />
                    <div style={{ height: 10, width: "60%", marginTop: 10, background: theme === "light" ? "#eef2f7" : "#242424", borderRadius: 999 }} />
                    <div style={{ height: 8, width: "40%", marginTop: 6, background: theme === "light" ? "#eef2f7" : "#242424", borderRadius: 999 }} />
                  </div>
                ))}
              </div>
            )}
            <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 20,
              }}
            >
              {gallery
                .filter((item) => (filter === "all" ? true : item.source === filter))
                .map(({ name, url, source, caption }) => (
                  <motion.div
                    key={name}
                    variants={scaleIn}
                    layout
                    whileHover={{ y: -3 }}
                    style={{
                      textAlign: "center",
                      padding: 10,
                      border: theme === "light" ? "1px solid #e5e7eb" : "1px solid #2a2a2a",
                      borderRadius: 12,
                      background: theme === "light" ? "#fafafa" : "#222",
                    }}
                  >
                    <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", borderRadius: 10, marginBottom: 8, cursor: "zoom-in", position: "relative" }} onClick={() => setLightbox({ open: true, name, url, caption, source })}>
                      <motion.img
                        src={url}
                        alt={name}
                        initial={{ opacity: 0.9 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.25 }}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.35), rgba(0,0,0,0))" }}
                      />
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{name}</p>
                    <p style={{ fontSize: 11, color: theme === "light" ? "#6b7280" : "#a3a3a3" }}>
                      {source === "gemini" ? "🧠 Gemini" : "📥 Manual"}
                    </p>
                    {caption && <p style={{ fontSize: 11, fontStyle: "italic" }}>“{caption}”</p>}
                    <button
                      onClick={() => handleDelete(name)}
                      style={{
                        marginTop: 8,
                        background: "#f44336",
                        color: "#fff",
                        border: "none",
                        padding: "6px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(244,67,54,0.35)",
                      }}
                    >
                      Delete
                    </button>
                  </motion.div>
                ))}
            </motion.div>
            </AnimatePresence>
          </section>
        )}
      </motion.div>
    </main>

    {/* Footer */}
    <footer
      style={{
        textAlign: "center",
        padding: "1rem",
        fontSize: "0.85rem",
        color: theme === "light" ? "#6b7280" : "#9ca3af",
        borderTop: theme === "light" ? "1px solid #eee" : "1px solid #2a2a2a",
      }}
    >
      © {new Date().getFullYear()} GenThumbAI ·{" "}
      <a href="#privacy" style={{ color: "#0070f3" }}>
        Privacy
      </a>{" "}
      ·{" "}
      <a href="#terms" style={{ color: "#0070f3" }}>
        Terms
      </a>
    </footer>
  {/* Lightbox */}
  <AnimatePresence>
    {lightbox.open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}
        onClick={() => setLightbox({ open: false })}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: theme === "light" ? "#fff" : "#111",
            borderRadius: 14,
            padding: 12,
            maxWidth: "92vw",
            maxHeight: "90vh",
            border: theme === "light" ? "1px solid #e5e7eb" : "1px solid #2a2a2a",
          }}
        >
          <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth: "80vw", maxHeight: "78vh", objectFit: "contain", borderRadius: 10 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{lightbox.name}</div>
              <div style={{ fontSize: 12, color: theme === "light" ? "#6b7280" : "#a3a3a3" }}>{lightbox.source === "gemini" ? "🧠 Gemini" : "📥 Manual"}</div>
            </div>
            <button
              onClick={() => setLightbox({ open: false })}
              style={{ border: "none", background: theme === "light" ? "#111827" : "#e5e7eb", color: theme === "light" ? "#fff" : "#111827", padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  {/* Success/Error Toast */}
  <AnimatePresence>
    {toast.open && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        style={{ position: "fixed", right: 16, top: 16, zIndex: 60, background: toast.type === "success" ? "#10b981" : "#ef4444", color: "#fff", padding: "10px 14px", borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.2)" }}
      >
        {toast.message}
      </motion.div>
    )}
  </AnimatePresence>
  </div>
);
}
