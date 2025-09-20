// gen-thumb-frontend/src/hooks/useUploadService.ts
import axios from "axios";

export function useUploadService() {
  const uploadThumbnail = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("thumbnail", file);

    const res = await axios.post("/api/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const { url } = res.data;
    return `${window.location.origin}${url}`;
  };

  return { uploadThumbnail };
}
