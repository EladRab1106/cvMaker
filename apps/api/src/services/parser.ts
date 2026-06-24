import type { ParsedCv, ParsedSection, CvSectionName } from "../types.js";

const SECTION_PATTERNS: Array<{ pattern: RegExp; name: CvSectionName }> = [
  { pattern: /^(summary|profile|about)$/i, name: "summary" },
  { pattern: /^(skills|technologies|tech stack|core stack|languages)$/i, name: "skills" },
  { pattern: /^(experience|work experience|employment)$/i, name: "experience" },
  { pattern: /^(projects|selected projects)$/i, name: "projects" },
  { pattern: /^(education)$/i, name: "education" },
];

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);
}

function detectName(lines: string[]): string {
  return lines[0] ?? "Candidate";
}

function detectContactLine(lines: string[]): string {
  const contactCandidates = lines.slice(1, 6);
  return (
    contactCandidates.find((line) =>
      /@|linkedin|github|phone|\+\d|israel|usa|uk|\.com/i.test(line),
    ) ?? ""
  );
}

function isSectionHeading(line: string): boolean {
  const normalized = line.replace(/[:|]/g, "").trim();
  if (normalized.length > 32) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).length;
  if (wordCount > 3) {
    return false;
  }

  return SECTION_PATTERNS.some((entry) => entry.pattern.test(normalized));
}

function sectionNameForLine(line: string): CvSectionName | null {
  const normalized = line.replace(/[:|]/g, "").trim();
  for (const entry of SECTION_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.name;
    }
  }
  return null;
}

export function parseCvText(rawText: string): ParsedCv {
  const lines = normalizeLines(rawText);
  const name = detectName(lines);
  const contactLine = detectContactLine(lines);

  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  for (const line of lines.slice(2)) {
    if (isSectionHeading(line)) {
      const detectedSection = sectionNameForLine(line);
      if (!detectedSection) {
        continue;
      }

      current = {
        name: detectedSection,
        title: line,
        lines: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        name: "other",
        title: "Other",
        lines: [],
      };
      sections.push(current);
    }

    current.lines.push(line.replace(/^[•\-]\s*/, ""));
  }

  return {
    name,
    contactLine,
    sections,
    rawText,
  };
}
