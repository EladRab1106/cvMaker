import OpenAI from "openai";
import type { GeneratedCvContent, ParsedCv } from "../types.js";

const ROLE_KEYWORDS: Record<string, string[]> = {
  frontend: ["react", "typescript", "javascript", "ui", "frontend", "css", "vite"],
  backend: ["node", "api", "express", "fastapi", "sql", "mongodb", "backend", "service"],
  "full stack": ["react", "node", "typescript", "api", "mongodb", "frontend", "backend"],
  ai: ["python", "langchain", "langgraph", "ml", "ai", "agent", "llm"],
  mobile: ["android", "kotlin", "mobile", "ios", "studio"],
};

function inferRoleKeywords(role: string): string[] {
  const lower = role.toLowerCase().replace(/-/g, " ");
  const matches = Object.entries(ROLE_KEYWORDS)
    .filter(([key]) => lower.includes(key))
    .flatMap(([, keywords]) => keywords);

  if (matches.length > 0) {
    return [...new Set(matches)];
  }

  return role
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((token) => token.length > 2);
}

function splitLines(parsed: ParsedCv, sectionName: string): string[] {
  return parsed.sections
    .filter((section) => section.name === sectionName)
    .flatMap((section) => section.lines);
}

function cleanLine(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/\b[a-z]+:\s*$/i, "")
    .trim();
}

function isStandaloneLabel(line: string): boolean {
  const words = line.split(/\s+/);
  if (/[–-].*\(/.test(line) && words.length <= 16) {
    return true;
  }

  return (
    words.length <= 12 &&
    !/[.?!]$/.test(line) &&
    !/\b(using|with|by|for|to|across|through)\b/i.test(line) &&
    !/^(built|designed|developed|implemented|integrated|supported|monitored|created|enabled|delivered|coordinated|moved|personalized|focused)\b/i.test(line)
  );
}

function mergeFragments(lines: string[]): string[] {
  const merged: string[] = [];

  for (const rawLine of lines.map(cleanLine).filter(Boolean)) {
    if (merged.length === 0) {
      merged.push(rawLine);
      continue;
    }

    const previous = merged[merged.length - 1];
    const append =
      !/[.?!]$/.test(previous) &&
      (/^[a-z]/.test(rawLine) ||
        previous.endsWith(",") ||
        previous.endsWith("-") ||
        /\b(and|or)$/.test(previous) ||
        rawLine.split(/\s+/).length <= 4);

    if (append) {
      merged[merged.length - 1] = `${previous} ${rawLine}`;
    } else {
      merged.push(rawLine);
    }
  }

  return merged;
}

function scoreLine(line: string, keywords: string[]): number {
  const lower = line.toLowerCase();
  return keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 3 : 0), 0);
}

function toFormulaBullet(line: string): string {
  const cleaned = line.replace(/\s+/g, " ").trim();
  if (/ by /i.test(cleaned) && /(improved|built|designed|developed|enabled|reduced|delivered|supported|turned|coordinated|moved|personalized)/i.test(cleaned)) {
    return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  }

  if (/(built|developed|designed|implemented|created)/i.test(cleaned)) {
    return `${cleaned} by combining product logic, technical implementation, and maintainable system design.`;
  }

  if (/(supported|monitored|maintained)/i.test(cleaned)) {
    return `${cleaned} by identifying issues early and keeping critical workflows stable.`;
  }

  return `${cleaned} by applying practical engineering execution to a real user or business workflow.`;
}

function compactSummary(parsed: ParsedCv, role: string, keywords: string[]): string {
  const topKeywords = [...new Set(keywords)]
    .map((keyword) => keyword.replace(/\b\w/g, (char) => char.toUpperCase()))
    .slice(0, 5)
    .join(", ");
  const skillsSnippet = collectSkills(parsed, keywords).slice(0, 6).join(", ");

  return `${role} candidate with hands-on experience across ${topKeywords || "software engineering"} and a background that combines product development, production support, and fast technical execution. Strongest tools include ${skillsSnippet || "modern web and backend technologies"}.`;
}

function collectSkills(parsed: ParsedCv, keywords: string[]): string[] {
  const skillsText = splitLines(parsed, "skills")
    .map(cleanLine)
    .filter((line) => !/^(frameworks|databases|tools|languages)$/i.test(line))
    .join(",");

  const parts = skillsText
    .split(/[:,]|,|\|/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && item.length < 40 && /[A-Za-z+#]/.test(item));

  const ranked = parts.sort((a, b) => scoreLine(b, keywords) - scoreLine(a, keywords));
  return [...new Set(ranked)].slice(0, 12);
}

function groupBullets(lines: string[], keywords: string[], limit: number): string[] {
  return mergeFragments(lines)
    .filter((line) => line.length > 30 && !isStandaloneLabel(line))
    .map((line) => ({ line, score: scoreLine(line, keywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ line }) => toFormulaBullet(line));
}

function buildDeterministicContent(parsed: ParsedCv, role: string): GeneratedCvContent {
  const keywords = inferRoleKeywords(role);
  const experienceLines = splitLines(parsed, "experience");
  const projectLines = splitLines(parsed, "projects");
  const educationLines = splitLines(parsed, "education");

  return {
    name: parsed.name,
    roleTitle: role,
    contactLine: parsed.contactLine,
    summary: compactSummary(parsed, role, keywords),
    skills: collectSkills(parsed, keywords),
    experience: [
      {
        heading: "Relevant Experience",
        bullets: groupBullets(experienceLines, keywords, 3),
      },
    ].filter((group) => group.bullets.length > 0),
    projects: [
      {
        heading: "Selected Projects",
        bullets: groupBullets(projectLines, keywords, 4),
      },
    ].filter((group) => group.bullets.length > 0),
    education: educationLines.slice(0, 3),
    additional: [
      "Generated from the candidate's source CV and tailored for the requested role without inventing unsupported achievements.",
    ],
  };
}

export async function rewriteCv(parsed: ParsedCv, role: string): Promise<GeneratedCvContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildDeterministicContent(parsed, role);
  }

  try {
    const client = new OpenAI({ apiKey });
    const fallback = buildDeterministicContent(parsed, role);
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You rewrite CVs for a desired software role. Keep claims grounded in the source CV. Favor strong achievement bullets in the form 'did X, impacting Y, by doing Z'. Output valid JSON only with fields: summary, skills, experienceBullets, projectBullets, educationLines.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                desiredRole: role,
                parsedCv: parsed,
                fallback,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cv_rewrite",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              skills: {
                type: "array",
                items: { type: "string" },
              },
              experienceBullets: {
                type: "array",
                items: { type: "string" },
              },
              projectBullets: {
                type: "array",
                items: { type: "string" },
              },
              educationLines: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "summary",
              "skills",
              "experienceBullets",
              "projectBullets",
              "educationLines",
            ],
          },
        },
      },
    });

    const json = JSON.parse(response.output_text);
    return {
      name: parsed.name,
      roleTitle: role,
      contactLine: parsed.contactLine,
      summary: json.summary,
      skills: json.skills.slice(0, 12),
      experience: [
        {
          heading: "Relevant Experience",
          bullets: json.experienceBullets.slice(0, 3),
        },
      ].filter((group) => group.bullets.length > 0),
      projects: [
        {
          heading: "Selected Projects",
          bullets: json.projectBullets.slice(0, 4),
        },
      ].filter((group) => group.bullets.length > 0),
      education: json.educationLines.slice(0, 3),
      additional: [
        "AI-assisted role tailoring using only source-backed information from the uploaded CV.",
      ],
    };
  } catch {
    return buildDeterministicContent(parsed, role);
  }
}
