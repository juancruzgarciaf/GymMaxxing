import { useRef, useState } from "react";
import { resolveMediaUrl } from "../lib/media";

type ExerciseMediaProps = {
  exerciseId: number;
  name: string;
  imageUrl?: string | null;
  canUpload?: boolean;
};

const API = "http://localhost:3000";
const AUTH_STORAGE_KEY = "gymmaxxing_auth_v1";

const getStoredToken = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
};

function ExerciseMedia({ exerciseId, name, imageUrl, canUpload = false }: ExerciseMediaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentImage, setCurrentImage] = useState(imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const resolvedImage = resolveMediaUrl(currentImage);

  const uploadImage = async (file: File) => {
    const token = getStoredToken();
    if (!token) {
      setError("Volvé a iniciar sesión");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(`${API}/ejercicios/${exerciseId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json()) as { imagen_url?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo subir la imagen");
      setCurrentImage(data.imagen_url ?? null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="exercise-media">
      {resolvedImage ? (
        <img src={resolvedImage} alt={name} className="exercise-media-image" />
      ) : (
        <div className="exercise-media-placeholder" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      {canUpload ? (
        <>
          <button
            type="button"
            className="exercise-media-upload"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Subiendo..." : resolvedImage ? "Cambiar foto" : "Agregar foto"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file);
              event.currentTarget.value = "";
            }}
          />
        </>
      ) : null}
      {error ? <small className="exercise-media-error">{error}</small> : null}
    </div>
  );
}

export default ExerciseMedia;
