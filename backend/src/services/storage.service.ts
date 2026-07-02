/**
 * Storage service — local disk (dev) or MinIO S3-compatible (production).
 *
 * When MINIO_ENDPOINT is set in .env, all file operations go through S3.
 * Otherwise, files are stored in backend/uploads/<userId>/ and served by Express.
 *
 * Callers use: storeFile, deleteFile, isS3Configured
 * Legacy local helpers still exported for any existing callers: userUploadDir, deleteLocalFile
 */

import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

// ── S3 client (lazy-initialised) ─────────────────────────────────────────────

let s3Client: any = null;
let s3PublicClient: any = null;

function makeS3Client(endpoint: string) {
  // Dynamic require so the module loads on Node 18+ without issues
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY,
    },
    forcePathStyle: true, // required for MinIO
  });
}

/** Internal client — uploads/deletes over the docker network endpoint. */
function getS3Client() {
  if (!s3Client) s3Client = makeS3Client(env.MINIO_ENDPOINT);
  return s3Client;
}

/**
 * Presigning client — bound to the BROWSER-facing endpoint. SigV4 signs the
 * Host header, so a URL presigned against the internal endpoint
 * (http://<ip>:9000) is both mixed-content-blocked on https pages AND cannot
 * be host-rewritten after signing. nginx proxies MINIO_PUBLIC_URL straight
 * into MinIO with the Host preserved, so signatures validate.
 */
function getPublicS3Client() {
  if (!s3PublicClient) s3PublicClient = makeS3Client(env.MINIO_PUBLIC_URL || env.MINIO_ENDPOINT);
  return s3PublicClient;
}

export function isS3Configured(): boolean {
  return !!(env.MINIO_ENDPOINT && env.MINIO_ACCESS_KEY && env.MINIO_SECRET_KEY);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Store a file buffer and return its public URL.
 * Dispatches to S3 (MinIO) or local disk depending on config.
 */
export async function storeFile(
  userId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  if (isS3Configured()) {
    return storeS3(userId, buffer, filename, mimeType);
  }
  return storeLocal(userId, buffer, filename);
}

/**
 * Generate a signed time-limited URL for a stored file.
 * - S3/MinIO: presigned GET URL (15 min default expiry)
 * - Local disk: short-lived JWT-token URL served by /uploads-signed/:token in index.ts
 *
 * Always prefer this over returning raw fileUrl to clients — sensitive documents
 * (KTP, payment proofs, student cards) must not be guessable or shareable.
 */
export async function getSignedUrl(fileUrl: string, expiresInSec: number = 900): Promise<string> {
  if (isS3Configured() && fileUrl.includes(`/${env.MINIO_BUCKET}/`)) {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl: s3GetSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const marker = `/${env.MINIO_BUCKET}/`;
    const idx = fileUrl.indexOf(marker);
    const key = fileUrl.slice(idx + marker.length);
    const cmd = new GetObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key });
    return await s3GetSignedUrl(getPublicS3Client(), cmd, { expiresIn: expiresInSec });
  }
  // Local-disk dev: emit a JWT-token URL. The /uploads-signed/:token endpoint
  // in index.ts validates the token and streams the file.
  const token = jwt.sign({ p: fileUrl }, env.JWT_SECRET, { expiresIn: expiresInSec });
  return `/uploads-signed/${token}`;
}

/**
 * Re-sign a STORED public-asset URL for the client (logos, posters).
 * - Our MinIO URL → fresh presigned GET (the bucket is private; the raw URL
 *   stored at upload time 403s, which is exactly the "broken logo" bug).
 * - Anything else (external URL, local-dev /uploads path served statically)
 *   passes through untouched — getSignedUrl would mangle it.
 */
export async function freshPublicUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (isS3Configured() && url.includes(`/${env.MINIO_BUCKET}/`)) {
    try {
      return await getSignedUrl(url);
    } catch {
      return url;
    }
  }
  return url;
}

/**
 * Verify a signed-URL JWT token (local-disk dev mode) and return the file path,
 * or null if the token is invalid/expired.
 */
export function verifySignedUrlToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { p?: string };
    return payload.p ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete a file by its stored URL. Silently ignores missing files.
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  if (isS3Configured()) {
    await deleteS3(fileUrl);
  } else {
    deleteLocalFile(fileUrl);
  }
}

// ── S3 / MinIO backend ────────────────────────────────────────────────────────

async function storeS3(
  userId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const key = `uploads/${userId}/${filename}`;
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.MINIO_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  const base = (env.MINIO_PUBLIC_URL || env.MINIO_ENDPOINT).replace(/\/$/, "");
  return `${base}/${env.MINIO_BUCKET}/${key}`;
}

async function deleteS3(fileUrl: string): Promise<void> {
  try {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    // Extract key from URL: everything after /<bucket>/
    const marker = `/${env.MINIO_BUCKET}/`;
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return;
    const key = fileUrl.slice(idx + marker.length);
    await getS3Client().send(
      new DeleteObjectCommand({ Bucket: env.MINIO_BUCKET, Key: key })
    );
  } catch (err) {
    console.error("storage: failed to delete S3 object", fileUrl, err);
  }
}

// ── Local disk backend ────────────────────────────────────────────────────────

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

/** Ensure the per-user upload directory exists and return its absolute path. */
export function userUploadDir(userId: string): string {
  const dir = path.join(UPLOADS_ROOT, userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function storeLocal(userId: string, buffer: Buffer, filename: string): Promise<string> {
  const dir = userUploadDir(userId);
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${userId}/${filename}`;
}

export function urlToLocalPath(fileUrl: string): string {
  return path.join(process.cwd(), fileUrl);
}

export function deleteLocalFile(fileUrl: string): void {
  try {
    const abs = urlToLocalPath(fileUrl);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (err) {
    console.error("storage: failed to delete file", fileUrl, err);
  }
}
