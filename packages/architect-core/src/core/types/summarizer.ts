export interface ProjectSummary {
  description: string;
  purpose: string;
  modules: { name: string; files: number; description: string }[];
  techStack: string[];
  entryPoints: string[];
  keywords: string[];
}
