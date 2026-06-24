import OpenAI from "openai";
import type { GeneratedCvContent, GeneratedCvGroup, ParsedCv, ParsedEntry } from "../types.js";

interface RoleProfile {
  normalizedRole: string;
  summaryLabel: string;
  tracks: string[];
  keywords: string[];
  prioritySkills: string[];
  preferredSignals: string[];
}

interface CandidateBullet {
  heading: string;
  sourceText: string;
  score: number;
  section: "experience" | "projects";
}

const ROLE_LIBRARY: Array<{
  pattern: RegExp;
  profile: Omit<RoleProfile, "normalizedRole" | "summaryLabel" | "tracks">;
}> = [
  {
    pattern: /\b(frontend|front end|ui|web ui)\b/i,
    profile: {
      keywords: ["react", "typescript", "javascript", "frontend", "ui", "css", "user", "web"],
      prioritySkills: ["React", "TypeScript", "JavaScript", "CSS", "Node.js"],
      preferredSignals: ["built user-facing", "frontend", "ui", "web application"],
    },
  },
  {
    pattern: /\b(backend|back end|server|api)\b/i,
    profile: {
      keywords: ["node", "api", "express", "fastapi", "backend", "service", "mongodb", "sql"],
      prioritySkills: ["Node.js", "TypeScript", "Python", "MongoDB", "SQL", "Express.js"],
      preferredSignals: ["api", "service", "backend", "persistence", "deployment"],
    },
  },
  {
    pattern: /\b(full[\s-]?stack|full stack)\b/i,
    profile: {
      keywords: ["react", "typescript", "node", "api", "mongodb", "frontend", "backend", "full-stack"],
      prioritySkills: ["TypeScript", "React", "Node.js", "MongoDB", "JavaScript", "Python"],
      preferredSignals: ["full-stack", "frontend", "backend", "web application", "analytics"],
    },
  },
  {
    pattern: /\b(qa|quality assurance|test engineer|sdet|automation tester)\b/i,
    profile: {
      keywords: ["qa", "test", "quality", "bug", "validation", "monitoring", "reliability", "automation", "defect"],
      prioritySkills: ["Python", "TypeScript", "JavaScript", "SQL", "Git", "Linux"],
      preferredSignals: ["identified errors", "system functionality", "monitoring", "stability", "validation"],
    },
  },
  {
    pattern: /\b(devops|site reliability|sre|platform|infrastructure|cloud)\b/i,
    profile: {
      keywords: ["deployment", "containers", "services", "infrastructure", "monitoring", "stability", "linux"],
      prioritySkills: ["Linux", "Python", "Git", "Node.js"],
      preferredSignals: ["containerized", "deployment", "services", "stability", "monitoring"],
    },
  },
  {
    pattern: /\b(data|analytics|bi|data engineer|data analyst)\b/i,
    profile: {
      keywords: ["data", "analytics", "mongodb", "sql", "tracking", "pipeline", "progress"],
      prioritySkills: ["SQL", "MongoDB", "Python", "TypeScript"],
      preferredSignals: ["analytics", "progress tracking", "user data", "data"],
    },
  },
  {
    pattern: /\b(ai|ml|machine learning|llm|nlp)\b/i,
    profile: {
      keywords: ["python", "langchain", "langgraph", "ai", "agent", "llm", "gemini"],
      prioritySkills: ["Python", "LangChain", "LangGraph", "TypeScript", "Node.js"],
      preferredSignals: ["multi-agent", "ai-driven", "automation", "personalized", "question generation"],
    },
  },
  {
    pattern: /\b(mobile|android|ios)\b/i,
    profile: {
      keywords: ["android", "kotlin", "mobile", "ui", "location", "image upload"],
      prioritySkills: ["Kotlin", "Android Studio", "Java"],
      preferredSignals: ["android", "mobile", "location", "user-generated content"],
    },
  },
  {
    pattern: /\b(security|cyber|application security)\b/i,
    profile: {
      keywords: ["security", "monitoring", "critical", "reliability", "validation", "troubleshooting"],
      prioritySkills: ["Python", "Linux", "Git", "SQL"],
      preferredSignals: ["critical", "classified", "under pressure", "identified errors"],
    },
  },
];

const ACTION_VERB_PATTERN =
  /\b(built|developed|designed|implemented|integrated|created|delivered|enabled|coordinated|supported|monitored|reduced|improved|automated|tested|validated|deployed|moved|focused|led|managed|contributed|served|performed|owned)\b/i;

function titleCaseRole(role: string): string {
  return role
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bQa\b/g, "QA")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bMl\b/g, "ML")
    .replace(/\bSdet\b/g, "SDET")
    .replace(/\bDevops\b/g, "DevOps")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bUx\b/g, "UX");
}

function buildRoleProfile(role: string): RoleProfile {
  const matchedProfiles = ROLE_LIBRARY.filter((entry) => entry.pattern.test(role));

  const mergedKeywords = matchedProfiles.flatMap((entry) => entry.profile.keywords);
  const mergedSkills = matchedProfiles.flatMap((entry) => entry.profile.prioritySkills);
  const mergedSignals = matchedProfiles.flatMap((entry) => entry.profile.preferredSignals);

  const fallbackTokens = role
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((token) => token.length > 2);

  const normalizedRole = titleCaseRole(role);
  return {
    normalizedRole,
    summaryLabel: normalizedRole,
    tracks: matchedProfiles.map((entry) => entry.pattern.source),
    keywords: [...new Set([...mergedKeywords, ...fallbackTokens])],
    prioritySkills: [...new Set(mergedSkills)],
    preferredSignals: [...new Set(mergedSignals)],
  };
}

function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\b([A-Za-z]+)-\s+on\b/g, "$1-on")
    .replace(/\b(Built|Developed|Designed|Implemented|Integrated|Focused)\.?$/, "")
    .trim();
}

function scoreText(text: string, profile: RoleProfile): number {
  const lower = text.toLowerCase();
  const keywordScore = profile.keywords.reduce(
    (score, keyword) => score + (lower.includes(keyword.toLowerCase()) ? 4 : 0),
    0,
  );
  const signalScore = profile.preferredSignals.reduce(
    (score, signal) => score + (lower.includes(signal.toLowerCase()) ? 3 : 0),
    0,
  );
  const actionBonus = ACTION_VERB_PATTERN.test(text) ? 2 : 0;
  const scopeBonus =
    /(used by|across|for user data|without shared storage|containerized|production|analytics|hospitals)/i.test(
      text,
    )
      ? 2
      : 0;

  return keywordScore + signalScore + actionBonus + scopeBonus;
}

function buildSummary(parsed: ParsedCv, profile: RoleProfile, selectedSkills: string[]): string {
  const summarySeed = parsed.summaryLines.join(" ");
  const roleFocus = profile.keywords
    .slice(0, 4)
    .map((keyword) => titleCaseRole(keyword))
    .join(", ");
  const lowerRole = profile.normalizedRole.toLowerCase();

  if (lowerRole.includes("qa")) {
    return `${profile.summaryLabel} candidate with hands-on experience diagnosing production issues, validating system behavior, and supporting reliability-critical environments. Strongest tools include ${selectedSkills.slice(0, 6).join(", ")}.`;
  }

  if (lowerRole.includes("frontend")) {
    return `${profile.summaryLabel} candidate with hands-on experience building user-facing products, working across React and TypeScript, and shaping maintainable interfaces under real-world delivery constraints. Strongest tools include ${selectedSkills.slice(0, 6).join(", ")}.`;
  }

  if (lowerRole.includes("backend")) {
    return `${profile.summaryLabel} candidate with hands-on experience building APIs, application logic, and data-backed services, with additional exposure to production troubleshooting and system stability. Strongest tools include ${selectedSkills.slice(0, 6).join(", ")}.`;
  }

  if (lowerRole.includes("full-stack")) {
    return `${profile.summaryLabel} candidate with hands-on experience building end-to-end web products across frontend, backend, and data flows, while contributing to production-grade systems under real-world constraints. Strongest tools include ${selectedSkills.slice(0, 6).join(", ")}.`;
  }

  if (lowerRole.includes("devops")) {
    return `${profile.summaryLabel} candidate with hands-on experience supporting production systems, deployment workflows, and service reliability across distributed technical environments. Strongest tools include ${selectedSkills.slice(0, 6).join(", ")}.`;
  }

  if (summarySeed) {
    return `${profile.summaryLabel} candidate with hands-on experience in ${roleFocus || "software delivery"}, combining product development, production ownership, and strong execution under real-world constraints. Strongest tools include ${selectedSkills.slice(0, 6).join(", ")}.`;
  }

  return `${profile.summaryLabel} candidate with hands-on experience in ${roleFocus || "software engineering"} and a track record of shipping technical work, supporting production systems, and solving operational problems with clear ownership.`;
}

function selectSkills(parsed: ParsedCv, profile: RoleProfile): string[] {
  const source = [...parsed.skillItems];
  const scored = source
    .map((skill) => ({
      skill,
      score:
        (profile.prioritySkills.some((target) => target.toLowerCase() === skill.toLowerCase()) ? 8 : 0) +
        scoreText(skill, profile),
    }))
    .sort((a, b) => b.score - a.score);

  const prioritized = [...new Set(scored.map(({ skill }) => skill))];
  return prioritized.slice(0, 12);
}

function extractCandidateBullets(
  entries: ParsedEntry[],
  section: "experience" | "projects",
  profile: RoleProfile,
): CandidateBullet[] {
  return entries.flatMap((entry) =>
    entry.bullets.map((bullet) => {
      const sourceText = sanitizeText(bullet);
      const headingWeight = scoreText(entry.heading, profile);
      const score = scoreText(sourceText, profile) + headingWeight + (section === "experience" ? 1 : 0);
      return {
        heading: entry.heading,
        sourceText,
        score,
        section,
      };
    }),
  );
}

function dedupeBullets(candidates: CandidateBullet[]): CandidateBullet[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.sourceText.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isWeakBullet(text: string): boolean {
  return !ACTION_VERB_PATTERN.test(text) && text.split(/\s+/).length < 14;
}

function shouldExcludeBullet(text: string, profile: RoleProfile): boolean {
  const lower = text.toLowerCase();
  if (lower.startsWith("served in the duvdevan") || lower.startsWith("served in the")) {
    const role = profile.normalizedRole.toLowerCase();
    return !/(security|devops|platform|sre|operations)/.test(role);
  }

  return false;
}

function sourceGroundedBullet(sourceText: string, heading: string): string {
  const text = sanitizeText(sourceText).replace(/\.$/, "");

  if (/ by /i.test(text)) {
    return `${text}.`;
  }

  if (
    /(using|with|through|via)\b/i.test(text) &&
    /(across|for|without|used by|to manage|to generate|to transfer|to track|to perform)\b/i.test(text)
  ) {
    return `${text}.`;
  }

  if (/^currently working as/i.test(text)) {
    const roleHeading = heading !== "General" ? `${heading}: ` : "";
    return `${roleHeading}${text}.`;
  }

  if (/^monitored and identified/i.test(text)) {
    return `${text}.`;
  }

  if (/^served in/i.test(text)) {
    return `${text}.`;
  }

  if (/^(built|developed|designed|implemented|integrated|created|enabled|coordinated|supported|tested|validated|automated)/i.test(text)) {
    return `${text}.`;
  }

  return `${text}.`;
}

function chooseBullets(
  entries: ParsedEntry[],
  section: "experience" | "projects",
  profile: RoleProfile,
  limit: number,
  minScore = 5,
): string[] {
  return dedupeBullets(extractCandidateBullets(entries, section, profile))
    .sort((a, b) => b.score - a.score)
    .filter(
      (candidate) =>
        candidate.score >= minScore &&
        !isWeakBullet(candidate.sourceText) &&
        !shouldExcludeBullet(candidate.sourceText, profile),
    )
    .slice(0, limit)
    .map((candidate) => sourceGroundedBullet(candidate.sourceText, candidate.heading));
}

function chooseEducation(parsed: ParsedCv): string[] {
  return parsed.educationLines
    .map(sanitizeText)
    .filter((line) => !/^languages$/i.test(line))
    .slice(0, 4);
}

function buildDeterministicContent(parsed: ParsedCv, role: string): GeneratedCvContent {
  const profile = buildRoleProfile(role);
  const skills = selectSkills(parsed, profile);
  const lowerRole = profile.normalizedRole.toLowerCase();
  const experienceBullets = chooseBullets(
    parsed.experienceEntries,
    "experience",
    profile,
    lowerRole.includes("qa") ? 2 : 3,
    5,
  );
  let projectBullets = chooseBullets(
    parsed.projectEntries,
    "projects",
    profile,
    lowerRole.includes("qa") ? 2 : 4,
    lowerRole.includes("qa") ? 7 : 5,
  );

  if (
    lowerRole.includes("qa") &&
    !projectBullets.some((bullet) => /(test|quality|validate|monitor|error|defect|reliability)/i.test(bullet))
  ) {
    projectBullets = [];
  }

  const experience: GeneratedCvGroup[] = experienceBullets.length
    ? [{ heading: "Relevant Experience", bullets: experienceBullets }]
    : [];
  const projects: GeneratedCvGroup[] = projectBullets.length
    ? [{ heading: "Selected Projects", bullets: projectBullets }]
    : [];

  return {
    name: parsed.name,
    roleTitle: profile.normalizedRole,
    contactLine: parsed.contactLine,
    summary: buildSummary(parsed, profile, skills),
    skills,
    experience,
    projects,
    education: chooseEducation(parsed),
    additional: [],
  };
}

async function aiRewriteCv(parsed: ParsedCv, role: string, fallback: GeneratedCvContent): Promise<GeneratedCvContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  const profile = buildRoleProfile(role);
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You rewrite CVs for software and technical roles. Keep all claims strictly grounded in the source CV. Never invent numbers, tools, tests, certifications, or responsibilities. Tailor to the requested role by selecting and rewriting the most relevant source-backed experience. Avoid generic AI phrasing. Each bullet should read like a recruiter-ready resume bullet, ideally in the shape 'did X, affecting Y, by doing Z' when the source supports it. If the source does not support a measurable Y, use a bounded scope from the source instead of making one up. Omit weak or irrelevant bullets. Return JSON only.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              desiredRole: profile.normalizedRole,
              roleProfile: profile,
              sourceCv: {
                name: parsed.name,
                contactLine: parsed.contactLine,
                summaryLines: parsed.summaryLines,
                skills: parsed.skillItems,
                experienceEntries: parsed.experienceEntries,
                projectEntries: parsed.projectEntries,
                educationLines: parsed.educationLines,
                additionalLines: parsed.additionalLines,
              },
              fallback,
              rules: [
                "Use title-cased role name.",
                "Summary must be 2 sentences max.",
                "Skills must be a concise prioritized list.",
                "Experience bullets must prioritize recruiter relevance for the desired role.",
                "Project bullets must stay specific and source-grounded.",
                "Do not include a Notes section.",
                "Do not include military service unless it is one of the strongest remaining relevant signals.",
              ],
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "tailored_cv",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            roleTitle: { type: "string" },
            summary: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            experience: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  heading: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                },
                required: ["heading", "bullets"],
              },
            },
            projects: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  heading: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                },
                required: ["heading", "bullets"],
              },
            },
            education: { type: "array", items: { type: "string" } },
          },
          required: ["roleTitle", "summary", "skills", "experience", "projects", "education"],
        },
      },
    },
  });

  const json = JSON.parse(response.output_text) as {
    roleTitle: string;
    summary: string;
    skills: string[];
    experience: GeneratedCvGroup[];
    projects: GeneratedCvGroup[];
    education: string[];
  };

  return {
    name: parsed.name,
    roleTitle: titleCaseRole(json.roleTitle || profile.normalizedRole),
    contactLine: parsed.contactLine,
    summary: sanitizeText(json.summary),
    skills: [...new Set(json.skills.map(sanitizeText))].slice(0, 12),
    experience: json.experience
      .map((group) => ({
        heading: sanitizeText(group.heading),
        bullets: group.bullets.map((bullet) => sanitizeText(bullet)).filter(Boolean).slice(0, 4),
      }))
      .filter((group) => group.bullets.length > 0)
      .slice(0, 2),
    projects: json.projects
      .map((group) => ({
        heading: sanitizeText(group.heading),
        bullets: group.bullets.map((bullet) => sanitizeText(bullet)).filter(Boolean).slice(0, 4),
      }))
      .filter((group) => group.bullets.length > 0)
      .slice(0, 2),
    education: json.education.map(sanitizeText).filter(Boolean).slice(0, 4),
    additional: [],
  };
}

export async function rewriteCv(parsed: ParsedCv, role: string): Promise<GeneratedCvContent> {
  const fallback = buildDeterministicContent(parsed, role);

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    return await aiRewriteCv(parsed, role, fallback);
  } catch {
    return fallback;
  }
}
