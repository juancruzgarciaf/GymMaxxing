import "dotenv/config";
import { Readable } from "stream";
import type { RequestHandler } from "express";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

/*
  Almacenamiento de fotos (perfil, entrenamientos y ejercicios).

  Si en el .env están las variables BUCKET_*, los archivos se guardan en el bucket de Railway
  (S3 compatible), compartido por todo el equipo y por el deploy. Si no están, se usa la carpeta
  backend/uploads como siempre, para que el proyecto siga andando sin configurar nada.

  En los dos casos la base guarda la misma ruta (/uploads/<carpeta>/<archivo>) y el backend la
  sirve en esa URL, así que el frontend no cambia.
*/

const bucketName = process.env.BUCKET_NAME?.trim();
const bucketEndpoint = process.env.BUCKET_ENDPOINT?.trim();
const bucketRegion = process.env.BUCKET_REGION?.trim() || "auto";
const bucketAccessKeyId = process.env.BUCKET_ACCESS_KEY_ID?.trim();
const bucketSecretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY?.trim();

export const isBucketStorageEnabled = Boolean(
  bucketName && bucketEndpoint && bucketAccessKeyId && bucketSecretAccessKey,
);

const UPLOAD_KEY_PATTERN = /^(profiles|trainings|exercises)\/[A-Za-z0-9._-]+$/;

let client: S3Client | null = null;

const getClient = () => {
  if (!client) {
    client = new S3Client({
      endpoint: bucketEndpoint ?? "",
      region: bucketRegion,
      credentials: {
        accessKeyId: bucketAccessKeyId ?? "",
        secretAccessKey: bucketSecretAccessKey ?? "",
      },
      forcePathStyle: process.env.BUCKET_URL_STYLE?.trim() === "path",
    });
  }

  return client;
};

const isNotFound = (error: unknown) =>
  error instanceof S3ServiceException &&
  (error.name === "NoSuchKey" || error.name === "NotFound" || error.$metadata?.httpStatusCode === 404);

export const uploadToBucket = async (key: string, body: Buffer, contentType: string) => {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

// Recibe la ruta guardada en la base (/uploads/exercises/archivo.jpg) y borra el archivo del bucket.
export const deleteUploadFromBucket = async (uploadUrl: string) => {
  if (!isBucketStorageEnabled || !uploadUrl.startsWith("/uploads/")) {
    return;
  }

  const key = uploadUrl.slice("/uploads/".length);
  if (!UPLOAD_KEY_PATTERN.test(key)) {
    return;
  }

  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }
};

// GET /uploads/<carpeta>/<archivo>: si el archivo no estaba en la carpeta local, lo trae del bucket.
// Soporta pedidos por rango (Range) para que los videos MP4 se puedan reproducir y adelantar.
export const serveUploadFromBucket: RequestHandler = async (req, res, next) => {
  if (!isBucketStorageEnabled) {
    next();
    return;
  }

  const splat = (req.params as { splat?: string | string[] }).splat;
  const key = Array.isArray(splat) ? splat.join("/") : String(splat ?? "");
  if (!UPLOAD_KEY_PATTERN.test(key)) {
    next();
    return;
  }

  const range = typeof req.headers.range === "string" ? req.headers.range : undefined;

  try {
    const object = await getClient().send(
      new GetObjectCommand({ Bucket: bucketName, Key: key, Range: range }),
    );

    if (!object.Body) {
      res.status(404).end();
      return;
    }

    res.status(range && object.ContentRange ? 206 : 200);
    if (object.ContentType) res.setHeader("Content-Type", object.ContentType);
    if (object.ContentLength != null) res.setHeader("Content-Length", String(object.ContentLength));
    if (object.ContentRange) res.setHeader("Content-Range", object.ContentRange);
    if (object.ETag) res.setHeader("ETag", object.ETag);
    res.setHeader("Accept-Ranges", "bytes");
    // Los nombres de archivo son únicos y nunca se pisan, así que el navegador los puede cachear.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const body = object.Body as Readable;
    body.on("error", (error) => {
      console.error("ERROR STREAM BUCKET:", error);
      res.destroy(error);
    });
    body.pipe(res);
  } catch (error) {
    if (isNotFound(error)) {
      res.status(404).json({ error: "Archivo no encontrado" });
      return;
    }

    if (error instanceof S3ServiceException && error.$metadata?.httpStatusCode === 416) {
      res.status(416).end();
      return;
    }

    next(error);
  }
};
