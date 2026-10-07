import { useCallback,useEffect,useRef,useState } from 'react';
import { getDiscoverProfiles } from '../api/profileService';
import { Profile } from '../types/models';

/** Debounced, paginated server search. Late responses cannot replace a newer query. */
export function useProfileSearch(query: string, accountId: string) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const revision = useRef(0);
  const busy = useRef(false);
  const page = useRef(1);

  const fetchPage = useCallback(async (pageNumber: number, generation: number) => {
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await getDiscoverProfiles({ search: query.trim(), page: pageNumber, page_size: 30 });
      if (generation !== revision.current) return;
      setProfiles(previous => Array.from(new Map(
        [...(pageNumber === 1 ? [] : previous), ...result.profiles]
          .filter(profile => profile.id !== accountId && profile.userId !== accountId)
          .map(profile => [profile.id, profile]),
      ).values()));
      page.current = pageNumber;
      setHasMore(result.hasMore);
    } catch {
      if (generation === revision.current) setError('Could not load profiles. Please try again.');
    } finally {
      if (generation === revision.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [query, accountId]);

  useEffect(() => {
    const generation = ++revision.current;
    setProfiles([]);
    setHasMore(false);
    setLoading(true);
    busy.current = true;
    const timer = setTimeout(() => fetchPage(1, generation), 300);
    return () => { clearTimeout(timer); revision.current += 1; };
  }, [fetchPage]);

  const refresh = useCallback(() => fetchPage(1, ++revision.current), [fetchPage]);
  const loadMore = useCallback(() => {
    if (!busy.current && hasMore && !error) return fetchPage(page.current + 1, revision.current);
  }, [fetchPage, hasMore, error]);
  return { profiles, loading, error, hasMore, refresh, loadMore };
}
