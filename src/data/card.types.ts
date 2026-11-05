export type Sourced = { text: string; sources: string[]; unverified?: boolean };

export type CardStep = {
  id: string;
  steady: string;
  warm: string;
  safety: boolean;
  sources: string[];
  unverified?: boolean;
};

export type Card = {
  id: string;
  title: string;
  group: string;
  chips: string[];
  steps: CardStep[];
  avoid: Sourced[];
  callDoctor: Sourced[];
  emergency: Sourced[];
  doctorQuestions: string[];
  patientIdeas: { text: string; reportCount: number }[];
  prepItems: string[];
  evidence: { reportCount: number; strength: 'thin' | 'moderate' | 'substantial' };
  conflicts: string[];
  status: 'source_checked' | 'doctor_reviewed';
};

export type SourceMap = Record<string, { title: string; url: string }>;

export type CardGroup = { id: string; name: string };
