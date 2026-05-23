import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  INVITATION_DEBUG_MODE:
    process.env.INVITATION_DEBUG_MODE === "true" ||
    process.env.NODE_ENV !== "production",
  PORT: parseInt(process.env.PORT || "3000", 10),
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  // The single account allowed to impersonate other users. Configurable so it
  // can change without a code edit; defaults to the project's admin account.
  SUPER_ADMIN_EMAIL: (process.env.SUPER_ADMIN_EMAIL || "admin@eduversal.com").toLowerCase(),
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "Competzy <noreply@competzy.id>",
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10),
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  TWILIO_VERIFY_SID: process.env.TWILIO_VERIFY_SID || "",
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || "",
  MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY || "",
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === "true",
  // Stripe (international USD checkout for non-Indonesia students). Optional —
  // when unset, the new /api/payments/stripe endpoint replies 503 and the web
  // dashboard falls back to the "contact organizer" copy. Production must set
  // all three on the backend service.
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  API_CO_ID_KEY: process.env.API_CO_ID_KEY || "",
  // MinIO / S3-compatible object storage (optional — falls back to local disk when absent)
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || "",       // e.g. http://localhost:9000
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || "",
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || "",
  MINIO_BUCKET: process.env.MINIO_BUCKET || "competzy",
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL || "",   // public base URL for object URLs
  // Base URL of the Next.js web app (for password-reset email links and similar).
  // Falls back to the request Origin header at runtime when this is unset.
  APP_URL: process.env.APP_URL || "http://localhost:3001",
};
