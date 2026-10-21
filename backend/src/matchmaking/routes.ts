import { Router } from 'express';
import { calculateDeterministicCompatibility } from './scoringEngine';
import { getEnhancedCompatibility } from './geminiService';
import { MatchProfile, PartnerPreferences } from './types';

export const matchmakingRouter = Router();
const recent = new Map<string, { count: number; reset: number }>();

// Reports configuration only; this is not a provider request or a delivery test.
matchmakingRouter.get('/capabilities', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json({ service: 'match-insights', version: 1,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim() && process.env.MEMBER_API_BASE_URL?.startsWith('https://')),
  });
});

function profile(raw: any): MatchProfile {
  const text = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 160) : undefined;
  const interests = raw.hobbies ?? raw.interests;
  const source = raw.partner_preferences ?? raw.partnerPreferences;
  const preferences: PartnerPreferences = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [key, snake] of [['city', 'city'], ['state', 'state'], ['motherTongue', 'mother_tongue'],
      ['education', 'education'], ['profession', 'profession'], ['diet', 'diet'], ['maritalStatus', 'marital_status']] as const) {
      const values = source[key] ?? source[snake];
      if (Array.isArray(values)) preferences[key] = values.filter((v): v is string => typeof v === 'string')
        .slice(0, 20).map(v => v.trim().slice(0, 160)).filter(Boolean);
    }
    for (const [key, snake] of [['minAge', 'min_age'], ['maxAge', 'max_age']] as const) {
      const value = source[key] ?? source[snake];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 18 && value <= 120) preferences[key] = value;
    }
    if (preferences.minAge !== undefined && preferences.maxAge !== undefined && preferences.minAge > preferences.maxAge) {
      delete preferences.minAge; delete preferences.maxAge;
    }
  }
  return {
    id: String(raw.id), age: typeof raw.age === 'number' && raw.age >= 18 && raw.age <= 120 ? raw.age : undefined,
    partnerPreferences: preferences, state: text(raw.state), maritalStatus: text(raw.marital_status ?? raw.maritalStatus),
    city: text(raw.work_location ?? raw.current_city ?? raw.city),
    motherTongue: text(raw.mother_tongue ?? raw.motherTongue),
    education: text(raw.highest_education ?? raw.education), profession: text(raw.occupation ?? raw.profession),
    diet: text(raw.lifestyle?.diet ?? raw.diet),
    interests: Array.isArray(interests) ? interests.filter((v): v is string => typeof v === 'string').slice(0, 15).map(v => v.slice(0, 80)) : [],
  };
}

/** Authenticate and resolve both profiles through the existing member API. */
matchmakingRouter.post('/compatibility', async (req, res) => {
  const authorization = req.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to view match insights.' });
  const { candidateId, useAi = false } = req.body ?? {};
  if (typeof candidateId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(candidateId) || typeof useAi !== 'boolean') {
    return res.status(400).json({ error: 'A valid candidateId and useAi boolean are required.' });
  }
  const base = process.env.MEMBER_API_BASE_URL;
  // Fail closed until the operator configures the trusted authentication service.
  if (!base || !base.startsWith('https://')) return res.status(503).json({ error: 'Match insights are not configured.' });
  try {
    const read = async (path: string) => {
      const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        headers: { Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Object.assign(new Error('Member API unavailable'), { status: response.status });
      const json: any = await response.json();
      return json?.data?.user ?? json?.data ?? json?.user ?? json;
    };
    const mine = await read('/auth/me/');
    if (!mine?.id) return res.status(401).json({ error: 'Could not verify the signed-in profile.' });
    const now = Date.now();
    for (const [id, item] of recent) if (item.reset <= now) recent.delete(id);
    const limit = recent.get(String(mine.id)) ?? { count: 0, reset: now + 60_000 };
    if (limit.count >= 5 || (!recent.has(String(mine.id)) && recent.size >= 5000)) {
      res.set('Retry-After', '60');
      return res.status(429).json({ error: 'Please wait before requesting more insights.' });
    }
    limit.count++; recent.set(String(mine.id), limit);
    // The upstream API enforces profile visibility, blocks, and membership.
    const candidate = await read(`/profiles/${encodeURIComponent(candidateId)}/`);
    if (!candidate?.id || String(candidate.id) !== candidateId) return res.status(404).json({ error: 'Profile unavailable.' });
    const a = profile(mine), b = profile(candidate);
    const result = useAi ? await getEnhancedCompatibility(a, b) : calculateDeterministicCompatibility(a, b);
    res.set('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error: any) {
    const status = [401, 403, 404].includes(error?.status) ? error.status : 503;
    return res.status(status).json({ error: status === 503 ? 'Match insights are temporarily unavailable.' : 'Profile access could not be confirmed.' });
  }
});
