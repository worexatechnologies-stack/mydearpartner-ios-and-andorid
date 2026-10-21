import type { Profile } from '../types/models';
import type { ProfileUpdatePayload } from '../api/types';

export type WebsiteField = {
  key: string;
  label: string;
  kind?: 'number' | 'date' | 'multiline';
  options?: string[];
};
export const websiteProfileSections: {
  id: string;
  title: string;
  description: string;
  fields: WebsiteField[];
}[] = [
  {
    id: 'basic',
    title: 'Basic & Lifestyle',
    description: 'Your identity, location, and introduction.',
    fields: [
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'gender', label: 'Gender', options: ['Male', 'Female', 'Other'] },
      {
        key: 'profile_created_by',
        label: 'Profile Created By',
        options: ['Self', 'Parent', 'Sibling', 'Relative', 'Friend'],
      },
      {
        key: 'date_of_birth',
        label: 'Date of Birth (YYYY-MM-DD)',
        kind: 'date',
      },
      { key: 'work_location', label: 'Current City' },
      { key: 'about', label: 'About Me', kind: 'multiline' },
      { key: 'hobbies', label: 'Hobbies & Interests (comma separated)' },
    ],
  },
  {
    id: 'personal',
    title: 'Personal & Religion',
    description: 'Your personal details and cultural background.',
    fields: [
      { key: 'marital_status', label: 'Marital Status' },
      { key: 'height', label: 'Height' },
      { key: 'weight', label: 'Weight' },
      { key: 'blood_group', label: 'Blood Group' },
      { key: 'complexion', label: 'Complexion' },
      { key: 'religion', label: 'Religion' },
      { key: 'mother_tongue', label: 'Mother Tongue' },
      { key: 'caste', label: 'Caste / Community' },
      { key: 'sub_caste', label: 'Sub-Caste' },
      { key: 'gothra', label: 'Gothra' },
      { key: 'star_nakshatra', label: 'Star / Nakshatra' },
    ],
  },
  {
    id: 'family',
    title: 'Family Details',
    description: 'Share your family background.',
    fields: [
      { key: 'father_status', label: 'Father’s Status' },
      { key: 'mother_status', label: 'Mother’s Status' },
      { key: 'num_brothers', label: 'Number of Brothers', kind: 'number' },
      { key: 'num_sisters', label: 'Number of Sisters', kind: 'number' },
      { key: 'family_type', label: 'Family Type' },
      { key: 'family_status', label: 'Family Status' },
      { key: 'family_location', label: 'Family Location' },
    ],
  },
  {
    id: 'career',
    title: 'Career & Education',
    description: 'Your qualifications and professional life.',
    fields: [
      { key: 'highest_education', label: 'Highest Education' },
      { key: 'education_detail', label: 'Education Details' },
      { key: 'occupation', label: 'Occupation' },
      { key: 'employed_in', label: 'Employed In' },
      { key: 'company', label: 'Company Name' },
      { key: 'annual_income', label: 'Annual Income' },
    ],
  },
  {
    id: 'preferences',
    title: 'Partner Preferences',
    description: 'Tell us about the companion you hope to meet.',
    fields: [
      { key: 'pref_age_min', label: 'Minimum Preferred Age', kind: 'number' },
      { key: 'pref_age_max', label: 'Maximum Preferred Age', kind: 'number' },
      { key: 'pref_height_min', label: 'Minimum Preferred Height' },
      { key: 'pref_height_max', label: 'Maximum Preferred Height' },
      { key: 'pref_religion', label: 'Preferred Religion' },
      { key: 'pref_caste', label: 'Preferred Caste' },
      { key: 'pref_location', label: 'Preferred Locations' },
      { key: 'pref_education', label: 'Preferred Education' },
      { key: 'pref_occupation', label: 'Preferred Occupation' },
      { key: 'pref_marital_status', label: 'Preferred Marital Status' },
      { key: 'pref_about', label: 'About Ideal Partner', kind: 'multiline' },
    ],
  },
];
export const websiteProfileFields = websiteProfileSections.flatMap(
  section => section.fields,
);

export function websiteProfileValues(
  profile?: Partial<Profile>,
): Record<string, string> {
  const parts = (profile?.name ?? '').trim().split(/\s+/);
  const fallback: Record<string, unknown> = {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
    gender: profile?.gender
      ? profile.gender[0].toUpperCase() + profile.gender.slice(1)
      : '',
    work_location: profile?.city,
    about: profile?.about,
    hobbies: profile?.interests,
    marital_status: profile?.maritalStatus,
    height: profile?.height,
    weight: profile?.weight,
    blood_group: profile?.bloodGroup,
    complexion: profile?.complexion,
    religion: profile?.religion,
    mother_tongue: profile?.motherTongue,
    caste: profile?.caste,
    sub_caste: profile?.subCaste,
    gothra: profile?.gothra,
    star_nakshatra: profile?.starNakshatra,
    father_status: profile?.fatherStatus,
    mother_status: profile?.motherStatus,
    family_type: profile?.familyType,
    family_status: profile?.familyStatus,
    family_location: profile?.familyLocation,
    highest_education: profile?.education,
    occupation: profile?.profession,
    company: profile?.company,
    annual_income: profile?.income,
    ...profile?.websiteFields,
  };
  return Object.fromEntries(
    websiteProfileFields.map(field => {
      const value = fallback[field.key];
      return [
        field.key,
        Array.isArray(value)
          ? value.join(', ')
          : typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : '',
      ];
    }),
  );
}

export function websiteProfileChanges(
  original: Record<string, string>,
  edited: Record<string, string>,
): ProfileUpdatePayload {
  const payload: Record<string, unknown> = {};
  for (const field of websiteProfileFields) {
    const value = (edited[field.key] ?? '').trim();
    if (value === (original[field.key] ?? '').trim()) continue;
    if (field.kind === 'number') {
      const minimum = field.key.startsWith('pref_age') ? 18 : 0;
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < minimum ||
        (minimum === 18 && Number(value) > 100)
      ) {
        throw new Error(
          `Enter a valid ${field.label.toLowerCase()}${
            minimum === 18 ? ' between 18 and 100' : ''
          }.`,
        );
      }
      payload[field.key] = Number(value);
    } else if (field.kind === 'date') {
      const date = new Date(value);
      if (
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== value)
      ) {
        throw new Error('Enter date of birth as YYYY-MM-DD.');
      }
      payload[field.key] = value || null;
    } else {
      payload[field.key] =
        field.key === 'hobbies'
          ? value
              .split(',')
              .map(item => item.trim())
              .filter(Boolean)
          : value;
    }
  }
  if (!edited.first_name?.trim() || !edited.work_location?.trim())
    throw new Error('Please enter your first name and current city.');
  if (
    edited.pref_age_min &&
    edited.pref_age_max &&
    Number(edited.pref_age_min) > Number(edited.pref_age_max)
  )
    throw new Error(
      'Minimum preferred age cannot exceed maximum preferred age.',
    );
  return payload as ProfileUpdatePayload;
}
