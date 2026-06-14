import fs from "fs";
import path from "path";
import multer from "multer";

type UploadFolder = "profiles" | "trainings" | "exercises";

const uploadsRoot = path.resolve(__dirname, "../../uploads");

const sanitizeExtension = (originalName: string) => {
  const extension = path.extname(originalName).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)
    ? extension
    : ".jpg";
};

export const createImageUpload = (folder: UploadFolder) => {
  const destination = path.join(uploadsRoot, folder);
  fs.mkdirSync(destination, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, destination),
      filename: (_req, file, callback) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        callback(null, `${uniqueName}${sanitizeExtension(file.originalname)}`);
      },
    }),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_req, file, callback) => {
      if (!file.mimetype.startsWith("image/")) {
        callback(new Error("Solo se permiten archivos de imagen"));
        return;
      }
      callback(null, true);
    },
  });
};

export const uploadedFileUrl = (folder: UploadFolder, filename: string) =>
  `/uploads/${folder}/${filename}`;
