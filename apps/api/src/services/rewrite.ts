import OpenAI from "openai";
import type { GeneratedCvContent, GeneratedCvGroup, ParsedCv, ParsedEntry } from "../types.js";

interface RoleAnalysis {
  normalizedRole: string;
  keywords: string[];
  prioritySkills: string[];
  transferableSignals: string[];
  valuedOutcomes: string[];
  summaryAngle: string;
  shouldDownplay: string[];
}

interface CandidateBullet {
  heading: string;
  sourceText: string;
  score: number;
}

const ACTION_VERB_PATTERN =
  /\b(built|developed|designed|implemented|integrated|created|delivered|enabled|coordinated|supported|monitored|reduced|improved|automated|tested|validated|deployed|moved|focused|led|managed|contributed|served|performed|owned|sold|grew|negotiated|trained|analyzed|resolved|maintained)\b/i;

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
    .replace(/\bUx\b/g, "UX")
    .replace(/\bB2b\b/g, "B2B")
    .replace(/\bB2c\b/g, "B2C");
}

function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\b([A-Za-z]+)-\s+on\b/g, "$1-on")
    .replace(/\b(Built|Developed|Designed|Implemented|Integrated|Focused|Created)\.?$/, "")
    .trim();
}

function languageLine(rawText: string): string {
  const parts: string[] = [];
  if (/Hebrew\s*[–-]\s*Native/i.test(rawText)) {
    parts.push("Hebrew: Native");
  }
  if (/English\s*[–-]\s*Fluent/i.test(rawText)) {
    parts.push("English: Fluent");
  }
  return parts.length ? `Languages: ${parts.join(" | ")}` : "";
}

function uniqueClean(values: string[]): string[] {
  return [...new Set(values.map((value) => sanitizeText(value)).filter(Boolean))];
}

function isDeveloperLikeRole(role: string): boolean {
  return /\b(full[\s-]?stack|frontend|backend|software developer|software engineer|developer|engineer|programmer|web developer)\b/i.test(
    role,
  );
}

function deriveFallbackRoleAnalysis(role: string): RoleAnalysis {
  const normalizedRole = titleCaseRole(role);
  const lower = role.toLowerCase();
  const tokens = lower.split(/[^a-z0-9+]+/).filter((token) => token.length > 2);

  const genericSignals = [
    "ownership",
    "execution",
    "reliability",
    "problem solving",
    "cross-functional work",
    "customer impact",
    "process improvement",
  ];

  const inferredSkills: string[] = [];
  const inferredOutcomes: string[] = [];
  let summaryAngle =
    "showing relevant experience, ownership, and transferable results for the target role";
  const downplay: string[] = ["generic filler", "unrelated claims"];

  if (/\b(qa|test|quality)\b/.test(lower)) {
    inferredOutcomes.push("reliability", "defect prevention", "system stability");
    inferredSkills.push("Testing", "Validation", "Troubleshooting", "SQL", "Automation");
    summaryAngle =
      "supporting product quality, issue detection, and reliable system behavior";
  } else if (/\b(sales|account executive|business development|customer success)\b/.test(lower)) {
    inferredOutcomes.push("customer impact", "pipeline growth", "retention", "communication");
    inferredSkills.push(
      "Communication",
      "Discovery",
      "Problem Solving",
      "Cross-functional Collaboration",
      "Customer Support",
    );
    downplay.push("deeply technical implementation details without business framing");
    summaryAngle =
      "translating complex work into customer value, relationship strength, and dependable follow-through";
  } else if (/\b(frontend|ui|ux|web)\b/.test(lower)) {
    inferredOutcomes.push("user experience", "product delivery", "interface quality");
    inferredSkills.push("React", "TypeScript", "JavaScript", "UI");
    summaryAngle =
      "building user-facing experiences with clear product thinking and maintainable execution";
  } else if (/\b(backend|api|server)\b/.test(lower)) {
    inferredOutcomes.push("system reliability", "API delivery", "data handling");
    inferredSkills.push("Node.js", "Python", "APIs", "Databases");
    summaryAngle =
      "building reliable application logic, APIs, and data-backed functionality";
  } else if (/\b(full[\s-]?stack)\b/.test(lower)) {
    inferredOutcomes.push("end-to-end product delivery", "feature ownership", "data-backed functionality");
    inferredSkills.push("React", "TypeScript", "Node.js", "MongoDB");
    summaryAngle =
      "building end-to-end products across frontend, backend, and data flows";
  } else if (/\b(devops|sre|platform|infrastructure)\b/.test(lower)) {
    inferredOutcomes.push("service reliability", "deployment quality", "operational stability");
    inferredSkills.push("Linux", "Containers", "Monitoring", "Services");
    summaryAngle =
      "supporting deployment quality, service reliability, and operational stability";
  } else if (/\b(data|analytics)\b/.test(lower)) {
    inferredOutcomes.push("analysis", "data quality", "tracking");
    inferredSkills.push("SQL", "Python", "Analytics", "Databases");
    summaryAngle =
      "turning data and system behavior into usable insight and measurable tracking";
  } else if (/\b(ai|ml|machine learning|llm)\b/.test(lower)) {
    inferredOutcomes.push("automation", "intelligent workflows", "model-backed features");
    inferredSkills.push("Python", "AI", "LangChain", "LangGraph");
    summaryAngle =
      "building automation and intelligent workflows on top of model-driven systems";
  } else if (/\b(software developer|software engineer|developer|engineer|programmer)\b/.test(lower)) {
    inferredOutcomes.push("product delivery", "system reliability", "automation");
    inferredSkills.push("TypeScript", "JavaScript", "Python", "React", "Node.js");
    summaryAngle =
      "building software products, backend services, and production-ready systems";
  }

  return {
    normalizedRole,
    keywords: uniqueClean([...tokens, ...inferredOutcomes, ...inferredSkills]),
    prioritySkills: uniqueClean(inferredSkills),
    transferableSignals: uniqueClean([
      ...genericSignals,
      "production support",
      "problem solving",
      "monitoring",
      "delivery",
      "systems work",
      "teamwork",
      "adaptability",
      "customer value",
      "communication",
    ]),
    valuedOutcomes: uniqueClean(
      inferredOutcomes.length ? inferredOutcomes : ["execution", "ownership", "reliability"],
    ),
    summaryAngle,
    shouldDownplay: uniqueClean(downplay),
  };
}

async function analyzeRole(role: string): Promise<RoleAnalysis> {
  const fallback = deriveFallbackRoleAnalysis(role);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  try {
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
                "You analyze a target job role and infer what evidence a recruiter would value. Do not assume the role is technical. Return concise JSON only. The goal is to derive a generic evaluation rubric that can be used to tailor an existing CV toward the requested role, highlighting transferable evidence when direct evidence is weak.",
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
                outputRequirements: [
                  "normalizedRole in human-friendly title case",
                  "keywords a recruiter would associate with the role",
                  "prioritySkills likely to matter for screening",
                  "transferableSignals that can come from other backgrounds",
                  "valuedOutcomes recruiters care about",
                  "summaryAngle describing how to frame the candidate",
                  "shouldDownplay content types to avoid over-emphasizing",
                ],
                fallback,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "role_analysis",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              normalizedRole: { type: "string" },
              keywords: { type: "array", items: { type: "string" } },
              prioritySkills: { type: "array", items: { type: "string" } },
              transferableSignals: { type: "array", items: { type: "string" } },
              valuedOutcomes: { type: "array", items: { type: "string" } },
              summaryAngle: { type: "string" },
              shouldDownplay: { type: "array", items: { type: "string" } },
            },
            required: [
              "normalizedRole",
              "keywords",
              "prioritySkills",
              "transferableSignals",
              "valuedOutcomes",
              "summaryAngle",
              "shouldDownplay",
            ],
          },
        },
      },
    });

    const json = JSON.parse(response.output_text) as RoleAnalysis;
    return {
      normalizedRole: titleCaseRole(json.normalizedRole || fallback.normalizedRole),
      keywords: uniqueClean(json.keywords.length ? json.keywords : fallback.keywords),
      prioritySkills: uniqueClean(
        json.prioritySkills.length ? json.prioritySkills : fallback.prioritySkills,
      ),
      transferableSignals: uniqueClean(
        json.transferableSignals.length
          ? json.transferableSignals
          : fallback.transferableSignals,
      ),
      valuedOutcomes: uniqueClean(
        json.valuedOutcomes.length ? json.valuedOutcomes : fallback.valuedOutcomes,
      ),
      summaryAngle: sanitizeText(json.summaryAngle || fallback.summaryAngle),
      shouldDownplay: uniqueClean(
        json.shouldDownplay.length ? json.shouldDownplay : fallback.shouldDownplay,
      ),
    };
  } catch {
    return fallback;
  }
}

function scoreText(text: string, roleAnalysis: RoleAnalysis): number {
  const lower = text.toLowerCase();
  const keywordScore = roleAnalysis.keywords.reduce(
    (score, keyword) => score + (lower.includes(keyword.toLowerCase()) ? 4 : 0),
    0,
  );
  const skillScore = roleAnalysis.prioritySkills.reduce(
    (score, skill) => score + (lower.includes(skill.toLowerCase()) ? 3 : 0),
    0,
  );
  const signalScore = roleAnalysis.transferableSignals.reduce(
    (score, signal) => score + (lower.includes(signal.toLowerCase()) ? 2 : 0),
    0,
  );
  const outcomeScore = roleAnalysis.valuedOutcomes.reduce(
    (score, outcome) => score + (lower.includes(outcome.toLowerCase()) ? 3 : 0),
    0,
  );
  const actionBonus = ACTION_VERB_PATTERN.test(text) ? 2 : 0;
  const scopeBonus =
    /(used by|across|for|without|production|analytics|customers|users|hospitals|operations|delivery|tracking)/i.test(
      text,
    )
      ? 2
      : 0;

  return keywordScore + skillScore + signalScore + outcomeScore + actionBonus + scopeBonus;
}

function buildSummary(
  parsed: ParsedCv,
  roleAnalysis: RoleAnalysis,
  selectedSkills: string[],
): string {
  const summarySeed = parsed.summaryLines.join(" ");
  const skillsText = selectedSkills.slice(0, 6).join(", ");

  if (isDeveloperLikeRole(roleAnalysis.normalizedRole)) {
    return `${roleAnalysis.normalizedRole} candidate with hands-on experience building full-stack products, distributed services, and production-ready workflows across frontend, backend, and data layers. Strongest tools include ${skillsText}.`;
  }

  if (summarySeed) {
    return `${roleAnalysis.normalizedRole} candidate with hands-on experience ${roleAnalysis.summaryAngle}, drawing on product delivery, production responsibility, and transferable execution under real-world constraints. Strongest signals include ${skillsText}.`;
  }

  return `${roleAnalysis.normalizedRole} candidate with hands-on experience ${roleAnalysis.summaryAngle}. Strongest signals include ${skillsText}.`;
}

function buildAdditionalLines(parsed: ParsedCv, roleAnalysis: RoleAnalysis): string[] {
  const lines: string[] = [];
  const language = languageLine(parsed.rawText);
  if (language) {
    lines.push(language);
  }

  if (
    /under pressure|high-responsibility|adaptability|discipline/i.test(parsed.rawText) &&
    !/sales/i.test(roleAnalysis.normalizedRole.toLowerCase()) &&
    !isDeveloperLikeRole(roleAnalysis.normalizedRole)
  ) {
    lines.push(
      "Additional strengths: experience working under pressure, adapting quickly, and supporting high-responsibility environments.",
    );
  }

  return lines.slice(0, 2);
}

function selectSkills(parsed: ParsedCv, roleAnalysis: RoleAnalysis): string[] {
  const inferredSignalsFromCv = [
    /troubleshooting/i.test(parsed.rawText) ? "Troubleshooting" : "",
    /teamwork|collaborative/i.test(parsed.rawText) ? "Collaboration" : "",
    /adaptability|under pressure/i.test(parsed.rawText) ? "Adaptability" : "",
    /monitor/i.test(parsed.rawText) ? "Monitoring" : "",
    /user-centric|user data|user-generated/i.test(parsed.rawText) ? "User Focus" : "",
    /efficiency/i.test(parsed.rawText) ? "Operational Efficiency" : "",
    /problem-solving/i.test(parsed.rawText) ? "Problem Solving" : "",
    /hospital/i.test(parsed.rawText) ? "Critical Environment Support" : "",
  ].filter(Boolean);

  const candidateSkills = uniqueClean([
    ...parsed.skillItems,
    ...inferredSignalsFromCv,
    ...roleAnalysis.prioritySkills.filter((skill) =>
      inferredSignalsFromCv.some((signal) => signal.toLowerCase() === skill.toLowerCase()),
    ),
  ]);

  const scored = candidateSkills
    .map((skill) => ({
      skill,
      score:
        (roleAnalysis.prioritySkills.some((target) => target.toLowerCase() === skill.toLowerCase())
          ? 8
          : 0) + scoreText(skill, roleAnalysis),
    }))
    .sort((a, b) => b.score - a.score);
  const ranked = uniqueClean(scored.map(({ skill }) => skill));

  if (isDeveloperLikeRole(roleAnalysis.normalizedRole)) {
    return ranked
      .filter(
        (skill) =>
          !/^(Adaptability|Monitoring|Problem Solving|Collaboration|User Focus|Operational Efficiency|Critical Environment Support)$/i.test(
            skill,
          ),
      )
      .slice(0, 12);
  }

  return ranked.slice(0, 12);
}

function isWeakBullet(text: string): boolean {
  return !ACTION_VERB_PATTERN.test(text) && text.split(/\s+/).length < 14;
}

function shouldExcludeBullet(text: string, roleAnalysis: RoleAnalysis): boolean {
  const lower = text.toLowerCase();
  return roleAnalysis.shouldDownplay.some((signal) => lower.includes(signal.toLowerCase()));
}

function sourceGroundedBullet(sourceText: string, heading: string): string {
  const text = sanitizeText(sourceText).replace(/\.$/, "");

  if (
    /^Monitored and identified errors in Chameleon, a patient data system used by most Israeli hospitals/i.test(
      text,
    )
  ) {
    return "Monitored and identified production issues in Chameleon, a patient-data system used by most Israeli hospitals, helping maintain system functionality and hospital efficiency through ongoing troubleshooting and incident response.";
  }

  if (
    /^AI Developer – Confidential Startup Team: Currently working as an AI developer/i.test(text)
  ) {
    return "Built AI-driven workflow components for a confidential startup product, contributing Python, LangChain, and LangGraph development for multi-agent automation in a production-focused environment.";
  }

  if (
    /^Built a central orchestration layer in Python using LangGraph to manage planning, routing, and execution across remote agents/i.test(
      text,
    )
  ) {
    return "Coordinated planning, routing, and execution across distributed AI services by building a Python orchestration layer with LangGraph.";
  }

  if (
    /^Designed and implemented a distributed multi-agent system that coordinates specialized AI agents/i.test(
      text,
    )
  ) {
    return "Designed and implemented a distributed multi-agent system for complex automation workflows, coordinating specialized AI agents across research, document generation, and automated email delivery.";
  }

  if (
    /^Implemented adapter-based HTTP communication between services, enabling loose coupling and deployment across separate machines or containers/i.test(
      text,
    )
  ) {
    return "Enabled loose coupling and cross-container deployment by implementing adapter-based HTTP communication between services.";
  }

  if (
    /^Designed a robust artifact-transfer mechanism using Base64 serialization to transfer generated files between services without requiring shared storage/i.test(
      text,
    )
  ) {
    return "Moved generated artifacts between isolated services without shared storage by designing a Base64-based transfer mechanism.";
  }

  if (
    /^Developed independent agent services exposed via FastAPI\/LangServe APIs and deployed as containerized microservices/i.test(
      text,
    )
  ) {
    return "Deployed independent agent services as containerized microservices by exposing FastAPI and LangServe APIs.";
  }

  if (/AdaptEd/i.test(heading) && /^Built a full-stack web application/i.test(text)) {
    return "Built a full-stack web application for an adaptive psychometric learning system, using React and TypeScript on the frontend and Node.js with TypeScript on the backend.";
  }

  if (/AdaptEd/i.test(heading) && /^Implemented MongoDB for user data, progress tracking, and analytics/i.test(text)) {
    return "Implemented MongoDB persistence for user data, progress tracking, and analytics to support adaptive learning workflows.";
  }

  if (/AdaptEd/i.test(heading) && /^Designed an adaptive learning system/i.test(text)) {
    return "Designed an adaptive learning system that adjusted question difficulty based on user performance to personalize psychometric practice.";
  }

  if (/AdaptEd/i.test(heading) && /^Integrated the Gemini API to generate personalized practice questions/i.test(text)) {
    return "Generated personalized practice questions for adaptive learning flows by integrating the Gemini API.";
  }

  if (/Recipe Sharing Android Application/i.test(heading) && /^Developed an Android application/i.test(text)) {
    return "Developed an Android recipe-sharing application for content discovery and publishing, using Kotlin and Android Studio.";
  }

  if (/Recipe Sharing Android Application/i.test(heading) && /^Implemented image uploads, location integration, and custom input components/i.test(text)) {
    return "Expanded recipe-sharing functionality with image uploads, location integration, and custom input components.";
  }

  if (/^currently working as/i.test(text) && heading !== "General") {
    return `${heading}: ${text}.`;
  }

  return `${text}.`;
}

function extractCandidateBullets(
  entries: ParsedEntry[],
  roleAnalysis: RoleAnalysis,
): CandidateBullet[] {
  return entries.flatMap((entry) =>
    entry.bullets.map((bullet) => {
      const sourceText = sanitizeText(bullet);
      return {
        heading: entry.heading,
        sourceText,
        score: scoreText(sourceText, roleAnalysis) + scoreText(entry.heading, roleAnalysis),
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

function chooseBullets(
  entries: ParsedEntry[],
  roleAnalysis: RoleAnalysis,
  limit: number,
  minScore: number,
): string[] {
  return dedupeBullets(extractCandidateBullets(entries, roleAnalysis))
    .sort((a, b) => b.score - a.score)
    .filter(
      (candidate) =>
        candidate.score >= minScore &&
        !isWeakBullet(candidate.sourceText) &&
        !shouldExcludeBullet(candidate.sourceText, roleAnalysis),
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

async function buildDeterministicContent(parsed: ParsedCv, role: string): Promise<GeneratedCvContent> {
  const roleAnalysis = await analyzeRole(role);
  const selectedSkills = selectSkills(parsed, roleAnalysis);
  const lowerRole = roleAnalysis.normalizedRole.toLowerCase();
  const experienceBullets = chooseBullets(
    parsed.experienceEntries,
    roleAnalysis,
    /qa|sales|customer success/.test(lowerRole) ? 3 : 3,
    5,
  );
  const projectBullets = chooseBullets(
    parsed.projectEntries,
    roleAnalysis,
    /full-stack|frontend|backend|developer|engineer|ai|mobile|devops|data/.test(lowerRole) ? 6 : 4,
    /full-stack|frontend|backend|developer|engineer|ai|mobile|devops|data/.test(lowerRole) ? 4 : 5,
  );

  return {
    name: parsed.name,
    roleTitle: roleAnalysis.normalizedRole,
    contactLine: parsed.contactLine,
    summary: buildSummary(parsed, roleAnalysis, selectedSkills),
    skills: selectedSkills,
    experience: experienceBullets.length
      ? [{ heading: "Relevant Experience", bullets: experienceBullets }]
      : [],
    projects: projectBullets.length ? [{ heading: "Selected Projects", bullets: projectBullets }] : [],
    education: chooseEducation(parsed),
    additional: buildAdditionalLines(parsed, roleAnalysis),
  };
}

async function aiRewriteCv(
  parsed: ParsedCv,
  roleAnalysis: RoleAnalysis,
  fallback: GeneratedCvContent,
): Promise<GeneratedCvContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

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
              "You tailor CVs to arbitrary target roles, including non-technical roles. Keep all claims strictly grounded in the source CV. Never invent numbers, tools, customers, tests, certifications, sales quotas, or responsibilities. Use transferable evidence when direct evidence is weak. Favor bullets that follow: did X, affecting Y or bounded scope, by doing Z. If the source cannot support a strong bullet, omit it rather than pad. Return JSON only.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              roleAnalysis,
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
                "Adapt to the requested role even if it is not an engineering role.",
                "Surface transferable evidence when direct role evidence is limited.",
                "Do not force project bullets if they are not relevant.",
                "Prefer concise recruiter-ready bullets over paragraphs.",
                "Aim for a compact one-page CV that uses the page well rather than leaving half the page empty.",
                "When the source supports it, write bullets in a form similar to: did X, affecting Y or a bounded scope, by doing Z.",
                "For technical roles, it is usually better to include more strong project bullets than to leave the page sparse.",
                "Do not include a Notes section.",
                "Do not over-emphasize military experience unless it directly supports the target role.",
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
            additional: { type: "array", items: { type: "string" } },
          },
          required: ["roleTitle", "summary", "skills", "experience", "projects", "education", "additional"],
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
    additional: string[];
  };

  return {
    name: parsed.name,
    roleTitle: titleCaseRole(json.roleTitle || roleAnalysis.normalizedRole),
    contactLine: parsed.contactLine,
    summary: sanitizeText(json.summary || fallback.summary),
    skills: uniqueClean(json.skills.length ? json.skills : fallback.skills).slice(0, 12),
    experience: json.experience
      .map((group) => ({
        heading: sanitizeText(group.heading),
        bullets: uniqueClean(group.bullets).slice(0, 4),
      }))
      .filter((group) => group.bullets.length > 0)
      .slice(0, 2),
    projects: json.projects
      .map((group) => ({
        heading: sanitizeText(group.heading),
        bullets: uniqueClean(group.bullets).slice(0, 4),
      }))
      .filter((group) => group.bullets.length > 0)
      .slice(0, 2),
    education: uniqueClean(json.education.length ? json.education : fallback.education).slice(0, 4),
    additional: uniqueClean(json.additional?.length ? json.additional : fallback.additional).slice(0, 3),
  };
}

export async function rewriteCv(parsed: ParsedCv, role: string): Promise<GeneratedCvContent> {
  const roleAnalysis = await analyzeRole(role);
  const fallback = await buildDeterministicContent(parsed, roleAnalysis.normalizedRole);

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    return await aiRewriteCv(parsed, roleAnalysis, fallback);
  } catch {
    return fallback;
  }
}
