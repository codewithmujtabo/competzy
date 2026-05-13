import nodemailer from "nodemailer";
import { env } from "../config/env";

const smtpConfigured = !!env.SMTP_USER && !!env.SMTP_PASS;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

export function isSmtpConfigured(): boolean {
  return smtpConfigured;
}

export async function sendMailOrThrow(options: nodemailer.SendMailOptions): Promise<void> {
  if (!transporter) {
    throw new Error("SMTP is not configured");
  }

  await transporter.sendMail(options);
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  await sendMailOrThrow({
    from: env.SMTP_FROM,
    to: email,
    subject: "Your Competzy OTP Code",
    text: `Your verification code is: ${code}\n\nThis code is valid for ${env.OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Competzy</h2>
        <p>Your verification code is:</p>
        <div style="background: #F0F0FF; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4F46E5;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code is valid for ${env.OTP_EXPIRY_MINUTES} minutes.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  });
}

export async function sendTempPasswordEmail(email: string, tempPassword: string, fullName: string): Promise<void> {
  await sendMailOrThrow({
    from: env.SMTP_FROM,
    to: email,
    subject: "Your Competzy Account — Temporary Password",
    text: `Hello ${fullName},\n\nAn account has been created for you on Competzy.\n\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nPlease log in and change your password as soon as possible.\n\nIf you did not expect this email, please ignore it.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Competzy</h2>
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>An account has been created for you on Competzy.</p>
        <table style="background: #F0F0FF; padding: 16px; border-radius: 8px; margin: 16px 0; width: 100%;">
          <tr><td style="color: #666; font-size: 13px;">Email</td><td style="font-weight: bold;">${email}</td></tr>
          <tr><td style="color: #666; font-size: 13px;">Temporary password</td><td style="font-weight: bold; color: #4F46E5; letter-spacing: 2px;">${tempPassword}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">Please log in and change your password as soon as possible.</p>
        <p style="color: #999; font-size: 12px;">If you did not expect this email, please ignore it.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  fullName: string | null,
): Promise<void> {
  const greeting = fullName ? `Hello ${fullName},` : "Hello,";
  await sendMailOrThrow({
    from: env.SMTP_FROM,
    to: email,
    subject: "Reset your Competzy password",
    text: `${greeting}

We received a request to reset your Competzy password. Open the link below to set a new one:

${resetUrl}

This link is valid for 15 minutes.

If you didn't request this, you can safely ignore this email — your password won't change.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Competzy</h2>
        <p>${greeting}</p>
        <p>We received a request to reset your Competzy password. Click the button below to set a new one:</p>
        <p style="margin: 24px 0; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Reset password</a>
        </p>
        <p style="color: #666; font-size: 14px;">Or paste this link into your browser:</p>
        <p style="color: #4F46E5; font-size: 13px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #666; font-size: 14px;">This link is valid for <strong>15 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  });
}

export async function sendParentInvitationEmail(email: string, pin: string, studentName: string): Promise<void> {
  await sendMailOrThrow({
    from: env.SMTP_FROM,
    to: email,
    subject: "Parent Account Invitation - Competzy",
    text: `${studentName} has invited you to link your parent account.\n\nYour verification PIN is: ${pin}\n\nThis PIN is valid for 24 hours.\n\nTo complete the linking process, open the Competzy app and enter this PIN when prompted.`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Competzy</h2>
        <p><strong>${studentName}</strong> has invited you to link your parent account.</p>
        <p>Your verification PIN is:</p>
        <div style="background: #F0F0FF; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #4F46E5;">${pin}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This PIN is valid for 24 hours.</p>
        <p style="color: #666; font-size: 14px;">To complete the linking process:</p>
        <ol style="color: #666; font-size: 14px;">
          <li>Open the Competzy app</li>
          <li>Go to your profile or children section</li>
          <li>Enter this PIN when prompted</li>
        </ol>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">If you didn't expect this invitation, please ignore this email.</p>
      </div>
    `,
  });
}
