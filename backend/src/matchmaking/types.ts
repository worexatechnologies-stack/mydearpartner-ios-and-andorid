export interface PartnerPreferences {
  minAge?: number;
  maxAge?: number;
  minHeight?: string;
  maxHeight?: string;
  maritalStatus?: string[];
  religion?: string[];
  caste?: string[];
  motherTongue?: string[];
  education?: string[];
  profession?: string[];
  city?: string[];
  state?: string[];
  diet?: string[];
  smoking?: string;
  drinking?: string;
  openToRelocation?: boolean;
}

export interface MatchProfile {
  id: string;
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | string;
  city?: string;
  state?: string;
  religion?: string;
  caste?: string;
  subCaste?: string;
  gothra?: string;
  motherTongue?: string;
  profession?: string;
  company?: string;
  education?: string;
  income?: string;
  height?: string;
  diet?: string;
  maritalStatus?: string;
  about?: string;
  interests?: string[];
  prompts?: { question: string; answer: string }[];
  starNakshatra?: string;
  manglikStatus?: string;
  familyType?: string;
  familyStatus?: string;
  familyLocation?: string;
  fatherStatus?: string;
  motherStatus?: string;
  managedBy?: string;
  lifestyle?: {
    diet?: string;
    smoking?: string;
    drinking?: string;
    livingArrangement?: string;
  };
  partnerPreferences?: PartnerPreferences;
  compatibilityScore?: number;
}

export interface FactorScore {
  factor: string;
  label: string;
  weight: number;
  score: number; // 0 to 1
  earnedPoints: number;
  applicable: boolean;
  strength?: string;
  consideration?: string;
}

export interface CompatibilityResult {
  candidateId: string;
  compatibilityScore: number | null; // Unknown when no comparable facts
  confidence: 'high' | 'medium' | 'low';
  dataCompleteness: number; // 0 to 100
  sharedStrengths: string[];
  considerations: string[];
  summary: string;
  explanation: string;
  factorBreakdown: FactorScore[];
  isAiEnhanced?: boolean;
  calculatedAt: string;
}

export interface WeightConfig {
  ageWeight: number; // default 15
  educationWeight: number; // default 10
  professionWeight: number; // default 10
  locationWeight: number; // default 10
  communityWeight: number; // default 10
  lifestyleWeight: number; // default 10
  familyWeight: number; // default 10
  marriageTimelineWeight: number; // default 10
  mutualPreferencesWeight: number; // default 10
  interestsWeight: number; // default 5
}

export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  ageWeight: 15,
  educationWeight: 10,
  professionWeight: 10,
  locationWeight: 10,
  communityWeight: 10,
  lifestyleWeight: 10,
  familyWeight: 10,
  marriageTimelineWeight: 10,
  mutualPreferencesWeight: 10,
  interestsWeight: 5,
};
