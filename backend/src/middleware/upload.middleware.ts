import fs from "fs";
import path from "path";
import multer from "multer";

type UploadFolder = "profiles" | "trainings" | "exercises";
type UploadOptions = {
  allowMp4?: boolean;
};

const uploadsRoot = path.resolve(__dirname, "../../uploads");
const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const videoExtensions = [".mp4"];

const sanitizeExtension = (
  originalName: string,
  mimetype: string,
  options: UploadOptions,
) => {
  const extension = path.extname(originalName).toLowerCase();
  if (imageExtensions.includes(extension)) return extension;
  if (options.allowMp4 && videoExtensions.includes(extension)) return extension;
  if (options.allowMp4 && mimetype === "video/mp4") return ".mp4";
  return ".jpg";
};

const isAllowedFile = (file: Express.Multer.File, options: UploadOptions) => {
  if (file.mimetype.startsWith("image/")) return true;
  return Boolean(options.allowMp4 && file.mimetype === "video/mp4");
};

export const createImageUpload = (
  folder: UploadFolder,
  options: UploadOptions = {},
) => {
  const destination = path.join(uploadsRoot, folder);
  fs.mkdirSync(destination, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, destination),
      filename: (_req, file, callback) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        callback(
          null,
          `${uniqueName}${sanitizeExtension(file.originalname, file.mimetype, options)}`,
        );
      },
    }),
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
    fileFilter: (_req, file, callback) => {
      if (!isAllowedFile(file, options)) {
        callback(
          new Error(
            options.allowMp4
              ? "Solo se permiten imagenes o videos MP4"
              : "Solo se permiten archivos de imagen",
          ),
        );
        return;
      }
      callback(null, true);
    },
  });
};

export const uploadedFileUrl = (folder: UploadFolder, filename: string) =>
  `/uploads/${folder}/${filename}`;
