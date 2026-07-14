/** Optional path: MyAnimeList's official API v2 (needs a Client ID). Faster and
 * cleaner than scraping, but MAL could revoke access — so the scraper is the
 * default and this is opt-in via ?source=official. */

import { buildImages, type ListResponse, type MalItem, type Tag } from './shape'

const MAL = 'https://api.myanimelist.net/v2'
const PER_PAGE = 25

const ANIME_FIELDS =
  'id,title,alternative_titles,main_picture,synopsis,mean,rank,popularity,num_list_users,media_type,status,genres,num_episodes,start_season,broadcast,studios'
const MANGA_FIELDS =
  'id,title,alternative_titles,main_picture,synopsis,mean,rank,popularity,num_list_users,media_type,status,genres,num_chapters,num_volumes,authors{first_name,last_name}'

const DOW: Record<string, string> = {
  sunday: 'Sundays',
  monday: 'Mondays',
  tuesday: 'Tuesdays',
  wednesday: 'Wednesdays',
  thursday: 'Thursdays',
  friday: 'Fridays',
  saturday: 'Saturdays',
}

const MEDIA_TYPE: Record<string, string> = {
  tv: 'TV',
  movie: 'Movie',
  ova: 'OVA',
  ona: 'ONA',
  special: 'Special',
  music: 'Music',
  manga: 'Manga',
  light_novel: 'Light Novel',
  novel: 'Novel',
  one_shot: 'One-shot',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
  doujinshi: 'Doujinshi',
}

const STATUS: Record<string, string> = {
  currently_airing: 'Currently Airing',
  finished_airing: 'Finished Airing',
  not_yet_aired: 'Not yet aired',
  currently_publishing: 'Publishing',
  finished: 'Finished',
  not_yet_published: 'Not yet published',
  on_hiatus: 'On Hiatus',
  discontinued: 'Discontinued',
}

type Node = Record<string, any>

const mapType = (t?: string) => (t ? MEDIA_TYPE[t] || t.toUpperCase() : null)
const mapStatus = (s?: string) => (s ? STATUS[s] || s : null)
const tags = (arr?: Node[]): Tag[] =>
  (arr || []).map((g) => ({ mal_id: g.id, name: g.name }))
const imagesOf = (n: Node) =>
  buildImages(
    n.main_picture?.large || n.main_picture?.medium || '',
    n.main_picture?.medium,
  )

function mapAnime(n: Node): MalItem {
  return {
    mal_id: n.id,
    url: `https://myanimelist.net/anime/${n.id}`,
    title: n.title,
    title_english: n.alternative_titles?.en || null,
    images: imagesOf(n),
    type: mapType(n.media_type),
    episodes: n.num_episodes || null,
    status: mapStatus(n.status),
    airing: n.status === 'currently_airing',
    score: n.mean ?? null,
    scored_by: null,
    rank: n.rank ?? null,
    popularity: n.popularity ?? null,
    members: n.num_list_users ?? null,
    synopsis: n.synopsis || null,
    season: n.start_season?.season || null,
    year: n.start_season?.year || null,
    broadcast: n.broadcast
      ? {
          day: DOW[n.broadcast.day_of_the_week] || null,
          time: n.broadcast.start_time || null,
          timezone: 'Asia/Tokyo',
          string: null,
        }
      : undefined,
    genres: tags(n.genres),
    themes: [],
    studios: tags(n.studios),
  }
}

function mapManga(n: Node): MalItem {
  return {
    mal_id: n.id,
    url: `https://myanimelist.net/manga/${n.id}`,
    title: n.title,
    title_english: n.alternative_titles?.en || null,
    images: imagesOf(n),
    type: mapType(n.media_type),
    episodes: null,
    chapters: n.num_chapters || null,
    volumes: n.num_volumes || null,
    status: mapStatus(n.status),
    airing: false,
    publishing: n.status === 'currently_publishing',
    score: n.mean ?? null,
    scored_by: null,
    rank: n.rank ?? null,
    popularity: n.popularity ?? null,
    members: n.num_list_users ?? null,
    synopsis: n.synopsis || null,
    season: null,
    year: null,
    genres: tags(n.genres),
    themes: [],
    studios: [],
    authors: (n.authors || []).map((a: Node) => ({
      mal_id: a.node?.id,
      name: [a.node?.last_name, a.node?.first_name].filter(Boolean).join(', '),
    })),
  }
}

async function malFetch(path: string, clientId: string): Promise<Node> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${MAL}${path}`, {
    headers: { 'X-MAL-CLIENT-ID': clientId },
  })
  if (!res.ok) throw new Error(`MAL API responded ${res.status}`)
  return res.json()
}

function paging(page: number): string {
  return `&limit=${PER_PAGE}&offset=${(page - 1) * PER_PAGE}`
}

function wrap(data: Node, page: number, map: (n: Node) => MalItem): ListResponse {
  return {
    data: (data.data || []).map((x: Node) => map(x.node)),
    pagination: { current_page: page, has_next_page: Boolean(data.paging?.next) },
  }
}

export async function seasonOfficial(
  year: number,
  season: string,
  page: number,
  clientId: string,
): Promise<ListResponse> {
  const data = await malFetch(
    `/anime/season/${year}/${season}?fields=${ANIME_FIELDS}${paging(page)}`,
    clientId,
  )
  return wrap(data, page, mapAnime)
}

export async function topMangaOfficial(
  page: number,
  clientId: string,
): Promise<ListResponse> {
  const data = await malFetch(
    `/manga/ranking?ranking_type=manga&fields=${MANGA_FIELDS}${paging(page)}`,
    clientId,
  )
  return wrap(data, page, mapManga)
}

export async function topAnimeOfficial(
  page: number,
  clientId: string,
): Promise<ListResponse> {
  const data = await malFetch(
    `/anime/ranking?ranking_type=all&fields=${ANIME_FIELDS}${paging(page)}`,
    clientId,
  )
  return wrap(data, page, mapAnime)
}

export async function searchAnimeOfficial(
  q: string,
  page: number,
  clientId: string,
): Promise<ListResponse> {
  const data = await malFetch(
    `/anime?q=${encodeURIComponent(q)}&fields=${ANIME_FIELDS}${paging(page)}`,
    clientId,
  )
  return wrap(data, page, mapAnime)
}

export async function searchMangaOfficial(
  q: string,
  page: number,
  clientId: string,
): Promise<ListResponse> {
  const data = await malFetch(
    `/manga?q=${encodeURIComponent(q)}&fields=${MANGA_FIELDS}${paging(page)}`,
    clientId,
  )
  return wrap(data, page, mapManga)
}

/** Single anime by id → { data: MalItem } (Jikan /anime/{id} shape). */
export async function animeDetailsOfficial(
  id: number,
  clientId: string,
): Promise<{ data: MalItem }> {
  const node = await malFetch(`/anime/${id}?fields=${ANIME_FIELDS}`, clientId)
  return { data: mapAnime(node) }
}

export async function mangaDetailsOfficial(
  id: number,
  clientId: string,
): Promise<{ data: MalItem }> {
  const node = await malFetch(`/manga/${id}?fields=${MANGA_FIELDS}`, clientId)
  return { data: mapManga(node) }
}
