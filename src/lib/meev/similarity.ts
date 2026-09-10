// MEEV — Friend & content recommendation engine (spec §5.2).
// Weighted similarity scoring: interest Jaccard (0.4) + geo proximity (0.25)
// + mutual friends (0.2) + activity-time proximity (0.15).

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let inter = 0
  for (const x of setA) if (setB.has(x)) inter++
  const union = setA.size + setB.size - inter
  return union === 0 ? 0 : inter / union
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Simple activity-hour overlap: fraction of the day (in hours) where both users
// are typically active, computed from lastActiveAt hour histograms.
export function activityOverlap(myHours: number[], theirHours: number[]): number {
  if (myHours.length < 2 || theirHours.length < 2) return 0.35 // neutral default
  const my = new Set(myHours)
  let hits = 0
  for (const h of theirHours) if (my.has(h)) hits++
  return Math.min(1, hits / Math.max(1, Math.min(my.size, theirHours.length)))
}

export const WEIGHTS = {
  interests: 0.4,
  geo: 0.25,
  mutual: 0.2,
  activity: 0.15,
} as const

export type Candidate = {
  userId: string
  interests: string[]
  city?: string | null
  mutualCount: number
  myHours: number[]
  theirHours: number[]
}

const CITY_COORDS: Record<string, [number, number]> = {
  // city-level only (never precise coordinates — privacy by design)
  riyadh: [24.71, 46.68], jeddah: [21.49, 39.19], dammam: [26.42, 50.09],
  dubai: [25.2, 55.27], doha: [25.29, 51.53], kuwait: [29.38, 47.98],
  cairo: [30.04, 31.24], alexandria: [31.2, 29.92], amman: [31.95, 35.93],
  beirut: [33.89, 35.5], casablanca: [33.57, -7.59], algiers: [36.75, 3.06],
  tunis: [36.8, 10.18], baghdad: [33.31, 44.36], muscat: [23.59, 58.41],
  london: [51.51, -0.13], paris: [48.86, 2.35], berlin: [52.52, 13.4],
  istanbul: [41.01, 28.98], newyork: [40.71, -74.01], tokyo: [35.68, 139.69],
  seoul: [37.57, 126.98], singapore: [1.35, 103.82], toronto: [43.65, -79.38],
}

export function geoScore(cityA?: string | null, cityB?: string | null): number {
  if (!cityA || !cityB) return 0.3 // unknown → neutral
  if (cityA.toLowerCase() === cityB.toLowerCase()) return 1
  const a = CITY_COORDS[cityA.toLowerCase()]
  const b = CITY_COORDS[cityB.toLowerCase()]
  if (!a || !b) return 0.4
  const km = haversineKm(a[0], a[1], b[0], b[1])
  if (km < 150) return 0.9
  if (km < 800) return 0.7
  if (km < 3000) return 0.5
  return 0.25
}

export function similarityScore(
  my: { interests: string[]; city?: string | null; myHours: number[] },
  c: Candidate
): number {
  const sInterests = jaccard(my.interests, c.interests)
  const sGeo = geoScore(my.city, c.city)
  const sMutual = Math.min(1, c.mutualCount / 5)
  const sActivity = activityOverlap(my.myHours, c.theirHours)
  return (
    sInterests * WEIGHTS.interests +
    sGeo * WEIGHTS.geo +
    sMutual * WEIGHTS.mutual +
    sActivity * WEIGHTS.activity
  )
}

export function parseInterests(json: string): string[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
