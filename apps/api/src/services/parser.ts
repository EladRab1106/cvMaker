import type { CvSectionName, ParsedCv, ParsedEntry, ParsedSection } from "../types.js";

const SECTION_PATTERNS: Array<{ pattern: RegExp; name: CvSectionName }> = [
  { pattern: /^(summary|profile|about)$/i, name: "summary" },
  { pattern: /^(skills|technologies|tech stack|core stack|languages)$/i, name: "skills" },
  { pattern: /^(experience|work experience|employment)$/i, name: "experience" },
  { pattern: /^(projects|selected projects)$/i, name: "projects" },
  { pattern: /^(education)$/i, name: "education" },
];

const ACTION_VERB_PATTERN =
  /^(built|developed|designed|implemented|integrated|created|delivered|enabled|coordinated|supported|monitored|reduced|improved|automated|tested|validated|deployed|moved|focused|led|managed|contributed|served|performed|owned)\b/i;

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/\s+/g, " ")
        .replace(/^[•\-]\s*/, "")
        .replace(/\s+([,.)])/g, "$1")
        .trim(),
    )
    .filter(Boolean);
}

function detectName(lines: string[]): string {
  return lines[0] ?? "Candidate";
}

function detectContactLine(lines: string[]): string {
  return (
    lines
      .slice(1, 8)
      .find((line) => /@|linkedin|github|\+\d|\.com|israel|usa|uk/i.test(line)) ?? ""
  );
}

function normalizedHeading(line: string): string {
  return line.replace(/[:|]/g, "").trim();
}

function isSectionHeading(line: string): boolean {
  const normalized = normalizedHeading(line);
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
  const normalized = normalizedHeading(line);
  for (const entry of SECTION_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.name;
    }
  }
  return null;
}

function isShortHeadingLike(line: string): boolean {
  const trimmed = line.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (trimmed.length > 90 || wordCount > 12) {
    return false;
  }

  if (ACTION_VERB_PATTERN.test(trimmed) || /[.?!]$/.test(trimmed)) {
    return false;
  }

  return (
    /[–-]/.test(trimmed) ||
    /\([^)]+\)/.test(trimmed) ||
    /^[A-Z][A-Za-z0-9/&,+.'() -]+$/.test(trimmed)
  );
}

function shouldAppendToPrevious(previous: string, current: string): boolean {
  return (
    !/[.?!]$/.test(previous) &&
    (/^[a-z]/.test(current) ||
      current.split(/\s+/).length <= 4 ||
      previous.endsWith(",") ||
      previous.endsWith("-") ||
      /\b(and|or|with|using|through|for|to)$/.test(previous))
  );
}

function mergeWrappedLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (const line of lines) {
    if (merged.length === 0) {
      merged.push(line);
      continue;
    }

    const previous = merged[merged.length - 1];
    if (shouldAppendToPrevious(previous, line)) {
      merged[merged.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ").trim();
    } else {
      merged.push(line);
    }
  }

  return merged;
}

function splitEmbeddedSegments(line: string): string[] {
  const actionSplit = line
    .split(
      /\s(?=(Built|Developed|Designed|Implemented|Integrated|Created|Enabled|Coordinated|Supported|Monitored|Reduced|Improved|Automated|Tested|Validated|Deployed|Moved|Focused|Led|Managed|Contributed|Served|Performed|Owned)\b)/,
    )
    .reduce<string[]>((parts, piece) => {
      if (!piece) {
        return parts;
      }
      if (parts.length === 0) {
        parts.push(piece);
        return parts;
      }
      if (/^(Built|Developed|Designed|Implemented|Integrated|Created|Enabled|Coordinated|Supported|Monitored|Reduced|Improved|Automated|Tested|Validated|Deployed|Moved|Focused|Led|Managed|Contributed|Served|Performed|Owned)\b/.test(piece)) {
        parts.push(piece);
      } else {
        parts[parts.length - 1] = `${parts[parts.length - 1]} ${piece}`.trim();
      }
      return parts;
    }, []);

  return actionSplit.flatMap((part) => {
    const embeddedHeading = part.match(/^(.*?)(\s)([A-Z][A-Za-z]+(?: [A-Z][A-Za-z&()\-]+){2,})$/);
    if (
      embeddedHeading &&
      !ACTION_VERB_PATTERN.test(embeddedHeading[3]) &&
      embeddedHeading[1].length > 35
    ) {
      return [embeddedHeading[1].trim(), embeddedHeading[3].trim()];
    }
    return [part.trim()];
  });
}

function extractSkillItems(sections: ParsedSection[]): string[] {
  const rawLines = sections
    .filter((section) => section.name === "skills")
    .flatMap((section) => section.lines);

  const items = rawLines
    .flatMap((line) => line.split(/[:,]|,|\|/))
    .map((item) => item.trim())
    .filter(
      (item) =>
        item.length > 1 &&
        item.length < 40 &&
        !/^(frameworks|databases|tools|languages)$/i.test(item),
    );

  return [...new Set(items)];
}

function parseEntries(lines: string[]): ParsedEntry[] {
  const merged = mergeWrappedLines(lines).flatMap(splitEmbeddedSegments).filter(Boolean);
  const entries: ParsedEntry[] = [];
  let current: ParsedEntry | null = null;

  for (const line of merged) {
    if (isShortHeadingLike(line)) {
      current = {
        heading: line,
        bullets: [],
      };
      entries.push(current);
      continue;
    }

    if (!current) {
      current = {
        heading: "General",
        bullets: [],
      };
      entries.push(current);
    }

    current.bullets.push(line);
  }

  return entries
    .map((entry) => ({
      heading: entry.heading,
      bullets: mergeWrappedLines(entry.bullets).filter(Boolean),
    }))
    .filter((entry) => entry.bullets.length > 0);
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

    current.lines.push(line);
  }

  const summaryLines = mergeWrappedLines(
    sections.filter((section) => section.name === "summary").flatMap((section) => section.lines),
  );
  const educationLines = mergeWrappedLines(
    sections.filter((section) => section.name === "education").flatMap((section) => section.lines),
  );
  const additionalLines = mergeWrappedLines(
    sections.filter((section) => section.name === "other").flatMap((section) => section.lines),
  );

  return {
    name,
    contactLine,
    sections,
    summaryLines,
    skillItems: extractSkillItems(sections),
    experienceEntries: parseEntries(
      sections.filter((section) => section.name === "experience").flatMap((section) => section.lines),
    ),
    projectEntries: parseEntries(
      sections.filter((section) => section.name === "projects").flatMap((section) => section.lines),
    ),
    educationLines,
    additionalLines,
    rawText,
  };
}
