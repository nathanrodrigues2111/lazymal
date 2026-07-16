/**
 * Dub availability for anime. MAL has no dub flag, and AniList (the reliable
 * source, keyed by the same MAL id) 403s our Cloudflare Worker — but it allows
 * CORS, so the browser queries AniList's GraphQL directly. A character with an
 * English-language voice actor means an English dub exists.
 *
 * Results are cached in localStorage: a confirmed dub is permanent so it's kept
 * for a month; "no dub yet" is held only briefly, because a title can gain a
 * dub later and a stale "false" would otherwise hide it forever. Once the short
 * TTL lapses (or the user refreshes) the status is re-checked.
 */
const ANILIST = 'https://graphql.anilist.co'
// v2: v1 was poisoned by an earlier Worker-side detector that wrongly cached
// "false" for dubbed titles; bumping the key discards those stale entries.
const KEY = 'lazymal-dub-v2'
const TRUE_TTL = 1000 * 60 * 60 * 24 * 30 // 30 days — dubs don't get removed
const FALSE_TTL = 1000 * 60 * 60 * 6 // 6 hours — re-check for a newly-added dub

interface Rec {
  v: boolean
  ts: number
}
type Store = Record<number, Rec>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function persist(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* quota / disabled storage — ignore */
  }
}

function fresh(r: Rec): boolean {
  return Date.now() - r.ts < (r.v ? TRUE_TTL : FALSE_TTL)
}

/** All currently-valid cached statuses, for hydrating the store at boot. */
export function loadDubCache(): Record<number, boolean> {
  const store = read()
  const out: Record<number, boolean> = {}
  for (const [id, r] of Object.entries(store)) if (fresh(r)) out[+id] = r.v
  return out
}

/** Cached status if still valid, else undefined (needs a network lookup). */
export function cachedDub(id: number): boolean | undefined {
  const r = read()[id]
  return r && fresh(r) ? r.v : undefined
}

function save(results: Record<number, boolean>): void {
  const store = read()
  const now = Date.now()
  for (const [id, v] of Object.entries(results)) store[+id] = { v, ts: now }
  persist(store)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface EpisodeInfo {
  /** Total planned episodes (null when unknown/ongoing with no set count). */
  total: number | null
  /** Subbed episodes released so far (aired in Japan). */
  airedSub: number | null
  /** Whether the show is still airing. */
  releasing: boolean
}

/**
 * Episode counts from AniList for one title: total planned and how many have
 * aired (subbed). AniList tracks the next airing episode, so aired = next − 1;
 * a finished show has all `episodes` out. There is no reliable free source for
 * a dubbed-episode count, so we don't attempt one.
 */
export async function fetchEpisodeInfo(
  id: number,
  signal?: AbortSignal,
): Promise<EpisodeInfo | null> {
  const query = `query{Media(idMal:${id},type:ANIME){episodes status nextAiringEpisode{episode}}}`
  try {
    const res = await fetch(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      signal,
    })
    if (!res.ok) return null
    const m = ((await res.json()) as {
      data?: {
        Media?: {
          episodes: number | null
          status: string | null
          nextAiringEpisode: { episode: number } | null
        } | null
      }
    }).data?.Media
    if (!m) return null
    const releasing = m.status === 'RELEASING'
    const airedSub = m.nextAiringEpisode
      ? m.nextAiringEpisode.episode - 1
      : releasing
        ? null
        : m.episodes
    return { total: m.episodes, airedSub, releasing }
  } catch {
    return null
  }
}

/**
 * Look up dub availability for a batch of titles in one AniList request (using
 * aliased queries), so a whole season costs a handful of calls rather than one
 * per title. Returns a map of the ids it could resolve; ids omitted from the
 * map stay unknown (a transient error) and will be retried later. Confirmed
 * statuses are written straight to the cache.
 */
export async function fetchDubBatch(
  ids: number[],
  signal?: AbortSignal,
): Promise<Record<number, boolean>> {
  const out: Record<number, boolean> = {}
  if (ids.length === 0) return out

  const parts = ids
    .map(
      (id, i) =>
        `m${i}:Media(idMal:${id},type:ANIME){characters(perPage:10,sort:[ROLE,RELEVANCE]){edges{node{id} voiceActors(language:ENGLISH){id}}}}`,
    )
    .join(' ')
  const query = `query{${parts}}`

  try {
    const call = () =>
      fetch(ANILIST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query }),
        signal,
      })
    let res = await call()
    if (res.status === 429) {
      const wait = Number(res.headers.get('Retry-After')) || 2
      await sleep(wait * 1000)
      res = await call()
    }
    if (!res.ok) return out

    type Media = {
      characters?: { edges?: { voiceActors?: unknown[] | null }[] }
    } | null
    const body = (await res.json()) as {
      data?: Record<string, Media>
      errors?: unknown[]
    }
    const data = body.data ?? {}
    const errored = Array.isArray(body.errors) && body.errors.length > 0

    ids.forEach((id, i) => {
      const key = `m${i}`
      if (!(key in data)) return
      const media = data[key]
      // A null field alongside errors is ambiguous (rate-limited mid-batch, not
      // "not found") — leave it unknown rather than caching a wrong "false".
      if (media === null && errored) return
      const edges = media?.characters?.edges ?? []
      out[id] = edges.some((e) => (e.voiceActors?.length ?? 0) > 0)
    })
  } catch {
    return out
  }

  save(out)
  return out
}
