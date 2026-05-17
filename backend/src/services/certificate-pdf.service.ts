// Certificate PDF rendering (EMC Wave 12 Phase 2).
//
// Renders a certificate as a one-page landscape-A4 PDF with PDFKit (the same
// library the Achievement PDF uses). The PDF is regenerated on demand from the
// `certificates` row — nothing is stored on disk; the row snapshots every
// printed value. A QR code (→ the public /verify/<code> page) and a Code128
// barcode (the certificate number) are rendered to PNG buffers and embedded.

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { env } from "../config/env";

const PAGE_W = 842; // landscape A4, points
const PAGE_H = 595;

// competzy.com identity (Wave 3): Electric Indigo violet, ink, ivory, hot pink.
const COLOR = {
  ivory: "#F4ECDC",
  violet: "#5627FF",
  ink: "#161214",
  pink: "#D9277B",
  muted: "#6B6358",
};

export interface CertificatePdfData {
  certificateNumber: string;
  verificationCode: string;
  type: string; // 'participation' | 'achievement'
  awardLabel: string | null;
  studentName: string;
  competitionName: string;
  grade: string | null;
  score: number | null;
  scoreMax: number | null;
  issuedAt: Date | string;
  revoked: boolean;
}

function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function fmtDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Render the certificate as a one-page landscape-A4 PDF buffer. */
export async function renderCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  const verifyUrl = `${env.APP_URL.replace(/\/$/, "")}/verify/${data.verificationCode}`;

  const qrBuf = await QRCode.toBuffer(verifyUrl, {
    margin: 1,
    width: 240,
    color: { dark: COLOR.ink, light: "#FFFFFF" },
  });
  const barcodeBuf = await bwipjs.toBuffer({
    bcid: "code128",
    text: data.certificateNumber,
    scale: 3,
    height: 9,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });

  const doc = new PDFDocument({ size: [PAGE_W, PAGE_H], margin: 0 });
  const out = docToBuffer(doc);

  // Background + double violet border.
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLOR.ivory);
  doc.lineWidth(3).strokeColor(COLOR.violet).rect(26, 26, PAGE_W - 52, PAGE_H - 52).stroke();
  doc.lineWidth(0.8).strokeColor(COLOR.violet).rect(34, 34, PAGE_W - 68, PAGE_H - 68).stroke();

  const isAchievement = data.type === "achievement" && !!data.awardLabel;

  // A centered line spanning the full inner width.
  const center = (
    txt: string,
    y: number,
    opts: { size: number; font?: string; color?: string }
  ) => {
    doc
      .font(opts.font ?? "Helvetica")
      .fontSize(opts.size)
      .fillColor(opts.color ?? COLOR.ink)
      .text(txt, 40, y, { width: PAGE_W - 80, align: "center" });
  };

  center("C O M P E T Z Y", 64, { size: 11, font: "Helvetica-Bold", color: COLOR.violet });
  center(
    isAchievement ? "Certificate of Achievement" : "Certificate of Participation",
    102,
    { size: 30, font: "Helvetica-Bold", color: COLOR.ink }
  );

  center("This is to certify that", 168, { size: 12, color: COLOR.muted });
  center(data.studentName, 190, { size: 34, font: "Helvetica-Bold", color: COLOR.violet });

  let y = 252;
  if (isAchievement) {
    center("is awarded", y, { size: 12, color: COLOR.muted });
    center(data.awardLabel!.toUpperCase(), y + 19, {
      size: 22,
      font: "Helvetica-Bold",
      color: COLOR.pink,
    });
    center("in", y + 55, { size: 12, color: COLOR.muted });
    center(data.competitionName, y + 74, { size: 18, font: "Helvetica-Bold", color: COLOR.ink });
    y += 112;
  } else {
    center("for participation in", y, { size: 12, color: COLOR.muted });
    center(data.competitionName, y + 20, { size: 20, font: "Helvetica-Bold", color: COLOR.ink });
    y += 60;
  }

  // Grade / score line.
  const bits: string[] = [];
  if (data.grade) bits.push(`Grade ${data.grade}`);
  if (data.score != null) {
    bits.push(
      `Score ${fmtNum(data.score)}${data.scoreMax != null ? ` / ${fmtNum(data.scoreMax)}` : ""}`
    );
  }
  if (bits.length) center(bits.join("        "), y, { size: 12, color: COLOR.muted });

  // ── Footer: issue date + number + barcode (left), QR (right) ──
  const footY = 472;
  doc.font("Helvetica").fontSize(10).fillColor(COLOR.muted);
  doc.text(`Issued ${fmtDate(data.issuedAt)}`, 70, footY, { width: 260 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLOR.ink);
  doc.text(`No. ${data.certificateNumber}`, 70, footY + 15, { width: 260 });
  doc.image(barcodeBuf, 70, footY + 36, { width: 172, height: 32 });

  const qrSize = 86;
  doc.image(qrBuf, PAGE_W - 70 - qrSize, footY - 6, { width: qrSize, height: qrSize });
  doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.muted);
  doc.text("Scan to verify this certificate", PAGE_W - 420, footY + 14, {
    width: 420 - 70 - qrSize - 8,
    align: "right",
  });
  doc.fontSize(7).text(verifyUrl, PAGE_W - 460, footY + 28, {
    width: 460 - 70 - qrSize - 8,
    align: "right",
  });

  // Revoked watermark.
  if (data.revoked) {
    doc.save();
    doc.rotate(-22, { origin: [PAGE_W / 2, PAGE_H / 2] });
    doc.font("Helvetica-Bold").fontSize(118).fillColor(COLOR.pink).opacity(0.16);
    doc.text("REVOKED", 0, PAGE_H / 2 - 66, { width: PAGE_W, align: "center" });
    doc.opacity(1).restore();
  }

  doc.end();
  return out;
}
