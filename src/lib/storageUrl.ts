const WORKER_URL = 'https://supabase-image-cache.moses-kabuswe.workers.dev'
const SUPABASE_STORAGE = 'https://pifpkfuulfnweeiqufbq.supabase.co/storage/v1/object/public'

export function cachedUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.includes(SUPABASE_STORAGE)) {
    return url.replace(SUPABASE_STORAGE, WORKER_URL)
  }
  return url
}
