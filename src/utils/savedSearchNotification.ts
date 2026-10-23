const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function savedSearchIdFromNotification(data: any): string | null {
  const type = String(data?.notification_type ?? data?.kind ?? data?.type ?? '').toUpperCase();
  if (type !== 'SAVED_SEARCH_MATCH') return null;
  if (typeof data?.saved_search_id === 'string' && UUID.test(data.saved_search_id)) return data.saved_search_id;
  const link = data?.url ?? data?.link_url;
  if (typeof link !== 'string' || !/^\/search\?/.test(link)) return null;
  const id = link.match(/[?&]saved_search=([0-9a-f-]+)(?:&|$)/i)?.[1];
  return id && UUID.test(id) ? id : null;
}
