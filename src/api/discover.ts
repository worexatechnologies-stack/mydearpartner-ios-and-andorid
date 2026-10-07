export interface Profile {
  id: string;
  name: string;
  age: number;
  city: string;
  religion: string;
  education: string;
  motherTongue: string;
  photoUrl: string;
  verified: boolean;
  matchPercent?: number;
}

export interface Quota {
  likesLeft: number;
  likesTotal: number;
  viewsLeft: number;
  viewsTotal: number;
  tier: 'free' | 'gold';
}

const MOCK_PROFILES: Profile[] = [
  {
    id: '1',
    name: 'Navya',
    age: 23,
    city: 'Mumbai',
    religion: 'Hindu',
    education: 'B.Tech',
    motherTongue: 'Hindi',
    photoUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=1000&auto=format&fit=crop',
    verified: true,
    matchPercent: 95,
  },
  {
    id: '2',
    name: 'Priya',
    age: 25,
    city: 'Delhi',
    religion: 'Hindu',
    education: 'MBA',
    motherTongue: 'Punjabi',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1000&auto=format&fit=crop',
    verified: false,
    matchPercent: 88,
  },
  {
    id: '3',
    name: 'Aisha',
    age: 24,
    city: 'Bangalore',
    religion: 'Muslim',
    education: 'M.Sc',
    motherTongue: 'Urdu',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop',
    verified: true,
  }
];

export const getProfiles = async (): Promise<Profile[]> => {
  // Simulate network delay
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_PROFILES), 800));
};

export const getQuota = async (): Promise<Quota> => {
  return new Promise((resolve) => resolve({
    likesLeft: 999,
    likesTotal: 1000,
    viewsLeft: 50,
    viewsTotal: 100,
    tier: 'free'
  }));
};

export const connect = async (_id: string): Promise<boolean> => {
  return new Promise((resolve) => setTimeout(() => resolve(true), 300));
};

export const pass = async (_id: string): Promise<boolean> => {
  return new Promise((resolve) => setTimeout(() => resolve(true), 300));
};

export const save = async (_id: string): Promise<boolean> => {
  return new Promise((resolve) => setTimeout(() => resolve(true), 300));
};
