import fs from "fs";
import path from "path";
import multer from "multer";
import type { RequestHandler } from "express";
import { isBucketStorageEnabled, uploadToBucket } from "../utils/storage";

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

const buildFileName = (file: Express.Multer.File, options: UploadOptions) => {
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${uniqueName}${sanitizeExtension(file.originalname, file.mimetype, options)}`;
};

export const createImageUpload = (
  folder: UploadFolder,
  options: UploadOptions = {},
) => {
  const destination = path.join(uploadsRoot, folder);
  if (!isBucketStorageEnabled) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const upload = multer({
    // Con bucket, el archivo queda en memoria y lo subimos nosotros; sin bucket, va directo al disco.
    storage: isBucketStorageEnabled
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination: (_req, _file, callback) => callback(null, destination),
          filename: (_req, file, callback) => callback(null, buildFileName(file, options)),
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

  const uploadToStorage: RequestHandler = async (req, _res, next) => {
    if (!isBucketStorageEnabled || !req.file) {
      next();
      return;
    }

    try {
      const filename = buildFileName(req.file, options);
      await uploadToBucket(`${folder}/${filename}`, req.file.buffer, req.file.mimetype);
      // Los controladores arman la URL con req.file.filename, igual que con el disco local.
      req.file.filename = filename;
      next();
    } catch (error) {
      next(error);
    }
  };

  return {
    single: (fieldName: string): RequestHandler[] => [upload.single(fieldName), uploadToStorage],
  };
};

export const uploadedFileUrl = (folder: UploadFolder, filename: string) =>
  `/uploads/${folder}/${filename}`;
