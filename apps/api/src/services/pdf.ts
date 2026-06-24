import PDFDocument from "pdfkit";
import type { GeneratedCvContent } from "../types.js";

function writeSectionTitle(doc: PDFKit.PDFDocument, text: string) {
  doc
    .moveDown(0.45)
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text(text);
}

function writeBullet(doc: PDFKit.PDFDocument, text: string) {
  doc
    .font("Helvetica")
    .fontSize(9.2)
    .fillColor("#1F2937")
    .text(`• ${text}`, {
      width: 510,
      indent: 12,
      paragraphGap: 3,
    });
}

export async function renderPdf(content: GeneratedCvContent): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 34,
      bottom: 32,
      left: 38,
      right: 38,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor("#0F172A")
    .text(content.name, { align: "center" });

  doc
    .moveDown(0.15)
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#2563EB")
    .text(content.roleTitle, { align: "center" });

  doc
    .moveDown(0.2)
    .font("Helvetica")
    .fontSize(10.2)
    .fillColor("#475569")
    .text(content.contactLine, { align: "center" });

  doc
    .moveDown(0.8)
    .font("Helvetica")
    .fontSize(10.4)
    .fillColor("#111827")
    .text(content.summary, {
      align: "left",
      width: 515,
    });

  writeSectionTitle(doc, "Core Skills");
  doc
    .font("Helvetica")
    .fontSize(9.3)
    .fillColor("#334155")
    .text(content.skills.join(" • "), {
      width: 515,
      lineGap: 2,
    });

  if (content.experience.length > 0) {
    writeSectionTitle(doc, "Experience");
    for (const group of content.experience) {
      doc
        .moveDown(0.18)
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#111827")
        .text(group.heading);

      group.bullets.forEach((bullet) => writeBullet(doc, bullet));
    }
  }

  if (content.projects.length > 0) {
    writeSectionTitle(doc, "Projects");
    for (const group of content.projects) {
      doc
        .moveDown(0.18)
        .font("Helvetica-Bold")
        .fontSize(10)
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
        .fontSize(9.2)
        .fillColor("#334155")
        .text(line, {
          width: 515,
          lineGap: 1.5,
        });
    });
  }

  if (content.additional.length > 0) {
    writeSectionTitle(doc, "Notes");
    content.additional.forEach((line) => {
      doc
        .font("Helvetica")
        .fontSize(8.4)
        .fillColor("#64748B")
        .text(line, {
          width: 515,
          lineGap: 1,
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
