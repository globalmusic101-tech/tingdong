const expectedVerses = Array.from({ length: 45 }, (_, i) => String(i + 1));

export function validateLocalKoreanBible(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'JSON object required' };
  if (value.version !== 1 || value.translation !== 'saehangul-2025') return { ok: false, error: 'Unsupported translation format' };
  if (value.book !== 'Mark' || value.chapter !== 1) return { ok: false, error: 'Only Mark chapter 1 is supported' };
  if (typeof value.name !== 'string' || !value.name.trim()) return { ok: false, error: 'Translation name is required' };
  if (value.sourceUrl !== undefined && (typeof value.sourceUrl !== 'string' || !/^https?:\/\//.test(value.sourceUrl))) return { ok: false, error: 'sourceUrl must be an http(s) URL' };
  if (!value.verses || typeof value.verses !== 'object' || Array.isArray(value.verses)) return { ok: false, error: 'verses object required' };
  if (Object.keys(value.verses).sort().join(',') !== [...expectedVerses].sort().join(',')) return { ok: false, error: 'Mark 1 must contain exactly verses 1-45' };
  for (const key of expectedVerses) if (typeof value.verses[key] !== 'string' || !value.verses[key].trim() || value.verses[key].length > 10000) return { ok: false, error: `Invalid verse ${key}` };
  return { ok: true, data: value };
}
