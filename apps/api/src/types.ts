export type CvSectionName =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "other";

export interface ParsedSection {
  name: CvSectionName;
  title: string;
  lines: string[];
}

export interface ParsedEntry {
  heading: string;
  bullets: string[];
}

export interface ParsedCv {
  name: string;
  contactLine: string;
  sections: ParsedSection[];
  summaryLines: string[];
  skillItems: string[];
  experienceEntries: ParsedEntry[];
  projectEntries: ParsedEntry[];
  educationLines: string[];
  additionalLines: string[];
  rawText: string;
}

export interface AchievementBullet {
  text: string;
  relevanceScore: number;
}

export interface GeneratedCvGroup {
  heading: string;
  bullets: string[];
}

export interface GeneratedCvContent {
  name: string;
  roleTitle: string;
  contactLine: string;
  summary: string;
  skills: string[];
  experience: GeneratedCvGroup[];
  projects: GeneratedCvGroup[];
  education: string[];
  additional: string[];
}
