import "dotenv/config";

import cors from "cors";
import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { z } from "zod";

import { parseCvText } from "./services/parser.js";
import { renderPdf } from "./services/pdf.js";
import { rewriteCv } from "./services/rewrite.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const requestSchema = z.object({
  desiredRole: z.string().min(2).max(120),
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/generate", upload.single("cvFile"), async (req, res) => {
  try {
    const parsedBody = requestSchema.parse({
      desiredRole: req.body.desiredRole,
    });

    if (!req.file) {
      return res.status(400).json({ error: "CV PDF is required." });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF uploads are supported in this MVP." });
    }

    const extracted = await pdfParse(req.file.buffer);
    const parsedCv = parseCvText(extracted.text);
    const rewritten = await rewriteCv(parsedCv, parsedBody.desiredRole);
    const pdfBuffer = await renderPdf(rewritten);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${rewritten.name.replace(/\s+/g, "_")}_${parsedBody.desiredRole.replace(/\s+/g, "_")}.pdf"`,
    );
    return res.send(pdfBuffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected CV generation failure.";
    return res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`cvMaker API listening on http://localhost:${port}`);
});
