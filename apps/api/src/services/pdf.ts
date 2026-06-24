import PDFDocument from "pdfkit";
import type { GeneratedCvContent } from "../types.js";

function drawSectionRule(doc: PDFKit.PDFDocument) {
  const y = doc.y + 3;
  doc
    .save()
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.8)
    .strokeColor("#DBE4F0")
    .stroke()
    .restore();
  doc.moveDown(0.55);
}

function writeSectionTitle(doc: PDFKit.PDFDocument, text: string) {
  drawSectionRule(doc);
  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor("#0F172A")
    .text(text.toUpperCase(), {
      characterSpacing: 1.2,
    });
}

function writeBullet(doc: PDFKit.PDFDocument, text: string) {
  doc
    .font("Helvetica")
    .fontSize(9.15)
    .fillColor("#1F2937")
    .text(`• ${text}`, {
      width: 510,
      indent: 10,
      paragraphGap: 3,
      lineGap: 1.2,
    });
}

export async function renderPdf(content: GeneratedCvContent): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 34,
      bottom: 28,
      left: 42,
      right: 42,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  doc
    .font("Helvetica-Bold")
    .fontSize(29)
    .fillColor("#0F172A")
    .text(content.name, { align: "center" });

  doc
    .moveDown(0.08)
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#2563EB")
    .text(content.roleTitle, { align: "center" });

  doc
    .moveDown(0.18)
    .font("Helvetica")
    .fontSize(10.4)
    .fillColor("#475569")
    .text(content.contactLine, { align: "center" });

  doc
    .moveDown(0.75)
    .font("Helvetica")
    .fontSize(10.15)
    .fillColor("#111827")
    .text(content.summary, {
      width: 510,
      align: "left",
      lineGap: 1.4,
    });

  writeSectionTitle(doc, "Core Skills");
  doc
    .font("Helvetica")
    .fontSize(9.35)
    .fillColor("#334155")
    .text(content.skills.join(" • "), {
      width: 510,
      lineGap: 1.8,
    });

  if (content.experience.length > 0) {
    writeSectionTitle(doc, "Experience");
    for (const group of content.experience) {
      doc
        .moveDown(0.12)
        .font("Helvetica-Bold")
        .fontSize(9.85)
        .fillColor("#111827")
        .text(group.heading);
      group.bullets.forEach((bullet) => writeBullet(doc, bullet));
    }
  }

  if (content.projects.length > 0) {
    writeSectionTitle(doc, "Projects");
    for (const group of content.projects) {
      doc
        .moveDown(0.12)
        .font("Helvetica-Bold")
        .fontSize(9.85)
        .fillColor("#111827")
        .text(group.heading);
      group.bullets.forEach((bullet) => writeBullet(doc, bullet));
    }
  }

  if (content.education.length > 0) {
    writeSectionTitle(doc, "Education");
    content.education.forEach((line) => {
      doc
        .font("Helvetica")
        .fontSize(9.15)
        .fillColor("#334155")
        .text(line, {
          width: 510,
          lineGap: 1.2,
        });
    });
  }

  doc.end();

  return await new Promise((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}
