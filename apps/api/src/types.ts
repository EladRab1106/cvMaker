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

export interface ParsedCv {
  name: string;
  contactLine: string;
  sections: ParsedSection[];
  rawText: string;
}

export interface AchievementBullet {
  text: string;
  relevanceScore: number;
}

export interface GeneratedCvContent {
  name: string;
  roleTitle: string;
  contactLine: string;
  summary: string;
  skills: string[];
  experience: Array<{
    heading: string;
    bullets: string[];
  }>;
  projects: Array<{
    heading: string;
    bullets: string[];
  }>;
  education: string[];
  additional: string[];
}
