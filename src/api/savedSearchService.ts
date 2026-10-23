import { del, get, patch, post } from './apiClient';
import { mapProfile } from './profileService';
import { BackendProfile, PaginatedResponse } from './types';

export interface SavedSearchFilters {
  query?: string;
  city?: string;
  religion?: string;
  mother_tongue?: string;
  marital_status?: string;
  education?: string;
  profession?: string;
  verified_only?: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  alerts_enabled: boolean;
  created_at: string;
  last_notified_at: string | null;
}

export interface SavedSearchAlert {
  id: string;
  search_id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

const path = (id: string) => `/saved-searches/${encodeURIComponent(id)}/`;
export const savedSearchService = {
  list: () => get<SavedSearch[]>('/saved-searches/'),
  get: (id: string) => get<SavedSearch>(path(id)),
  create: (name: string, filters: SavedSearchFilters, alertsEnabled: boolean) =>
    post<SavedSearch>('/saved-searches/', { name, filters, alerts_enabled: alertsEnabled }),
  update: (id: string, alertsEnabled: boolean) =>
    patch<SavedSearch>(path(id), { alerts_enabled: alertsEnabled }),
  remove: (id: string) => del(path(id)),
  alerts: () => get<SavedSearchAlert[]>('/saved-searches/alerts/'),
  readAlert: (id: string) => patch(`/saved-searches/alerts/${encodeURIComponent(id)}/`, {}),
  results: async (id: string, page: number) => {
    const response = await get<PaginatedResponse<BackendProfile>>(`${path(id)}results/?page=${page}&page_size=30`);
    return { profiles: response.results.map(mapProfile), hasMore: Boolean(response.next) };
  },
};

/** Stable comparison keeps an applied saved search active until its filters change. */
export function savedSearchFilterKey(filters: SavedSearchFilters): string {
  return JSON.stringify(Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== '' && value !== false)
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    .sort(([a], [b]) => String(a).localeCompare(String(b))));
}
