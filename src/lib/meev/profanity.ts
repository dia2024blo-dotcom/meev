// MEEV v3 — Profanity / abuse filter (bilingual AR + EN)
// Shared by the message pipeline, posts, comments, profile edits,
// registration and support tickets. Two levels:
//   - mask:  soft words get replaced with 🙈 (message still delivers)
//   - block: hard abuse / slurs / harassment → the request is rejected
// Arabic matching ignores diacritics, the tatweel (ـ) and letter
// variants (أ/إ/آ → ا, ى → ي, ة → ه) and tolerates attached prefixes
// (و كلب، ف غبي، ال...) so "وكلب" and "كُلـــب" both hit.

// ---------------- normalization ----------------
const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g

export function normalizeArabic(text: string): string {
  return text
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
}

const isArabicWord = (w: string) => /[\u0600-\u06FF]/.test(w)

// ---------------- word lists (curated: no innocent-word collisions) ----------------
/** Soft profanity / insults → masked with 🙈 */
const SOFT_WORDS = [
  // Arabic (normalized)
  'غبي', 'احمق', 'حمار', 'كلب', 'كلاب', 'قرد', 'خنزير', 'بقره', 'تافه', 'حقير', 'وسخ', 'قذر',
  'مغفل', 'معفن', 'خرا', 'زفت', 'سخيف', 'غثيث', 'ممل', 'ثقل', 'بلوه',
  // English (+ common plurals — the right word boundary means singular
  // entries alone never match 'idiots'/'morons'/'losers')
  'stupid', 'idiot', 'idiots', 'dumb', 'moron', 'morons', 'loser', 'losers', 'trash', 'garbage', 'annoying', 'lame', 'pathetic', 'shut up',
]

/** Hard abuse → request rejected */
const HARD_WORDS = [
  // Arabic (normalized)
  'شرموط', 'قحبه', 'قحب', 'عاهره', 'شاذ', 'منيك', 'نيك', 'زب', 'كس', 'طيز', 'منيوم', 'خول',
  'ابن الحرام', 'متناك', 'متنك', 'عرص', 'كواد',
  // English slurs / hard abuse (+ common plurals, compounds & derivations —
  // the strict word boundaries mean 'fuck' alone never matches 'fucker' or
  // 'motherfucker', and 'shit' never matches 'bullshit')
  'fuck', 'fck', 'fuk', 'fucking', 'fucker', 'motherfucker', 'fucked', 'fucks', 'shit', 'bullshit', 'shithead', 'shitty', 'shits', 'shitting', 'bitch', 'bitches', 'bastard', 'bastards', 'asshole', 'assholes', 'dick', 'pussy', 'cunt', 'whore', 'whores', 'slut', 'sluts', 'retard', 'retards', 'nigg',
]

// ---------------- pattern builder ----------------
// Arabic: tolerate one attached prefix letter (و ف ب ل ك) or ال and mask it
// together with the word. Right boundary stays strict so كلاب/كسكس don't
// trigger on كلب/كس stems. Latin: strict word-ish left boundary.
function buildPattern(words: string[]): RegExp {
  const ar = words.filter(isArabicWord)
  const en = words.filter((w) => !isArabicWord(w))
  const parts: string[] = []
  if (ar.length) {
    const body = ar
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|')
    parts.push(`((?:و|ف|ب|ل|ك|ال)?)(${body})(?![\\p{L}\\p{N}])`)
  }
  if (en.length) {
    const body = en
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length)
      .join('|')
    parts.push(`(^|[^\\p{L}\\p{N}])(${body})(?![\\p{L}\\p{N}])`)
  }
  return new RegExp(parts.join('|'), 'giu')
}

const SOFT_PATTERN = buildPattern(SOFT_WORDS)
const HARD_PATTERN = buildPattern(HARD_WORDS)

// ---------------- API ----------------

/** Stateful /g regexes: always reset lastIndex before .test */
function testPattern(pattern: RegExp, s: string): boolean {
  pattern.lastIndex = 0
  return pattern.test(s)
}

function maskWith(pattern: RegExp, s: string): string {
  return s.replace(pattern, (match: string) => {
    const letters = match.replace(/[^\p{L}\p{N}]/gu, '').length
    const fill = '🙈'.repeat(Math.min(4, Math.max(1, Math.ceil(letters / 3))))
    return match.replace(/[\p{L}\p{N}]+/gu, fill)
  })
}

export type ProfanityResult = {
  /** true when at least one soft word was masked */
  masked: boolean
  /** true when hard abuse was found (caller must reject) */
  hard: boolean
  text: string
}

/** Detect + mask soft profanity. Check `.hard` and reject when true. */
export function filterProfanity(raw: string): ProfanityResult {
  if (!raw) return { masked: false, hard: false, text: raw }

  const normalized = normalizeArabic(raw)
  const hard = testPattern(HARD_PATTERN, normalized) || testPattern(HARD_PATTERN, raw)

  const text = maskWith(SOFT_PATTERN, raw)
  if (text !== raw) return { masked: true, hard, text }

  // normalized arabic soft pass (diacritics/stripped variants)
  const stripped = maskWith(SOFT_PATTERN, normalized)
  if (stripped !== normalized) return { masked: true, hard, text: stripped }

  return { masked: false, hard, text: raw }
}

/** True when the text contains hard abuse. */
export function hasHardProfanity(raw: string): boolean {
  if (!raw) return false
  const normalized = normalizeArabic(raw)
  return testPattern(HARD_PATTERN, normalized) || testPattern(HARD_PATTERN, raw)
}

/** Validation guard for names/usernames: no profanity of ANY level. */
export function containsProfanity(raw: string): boolean {
  if (!raw) return false
  const normalized = normalizeArabic(raw)
  return (
    testPattern(SOFT_PATTERN, normalized) ||
    testPattern(SOFT_PATTERN, raw) ||
    hasHardProfanity(raw)
  )
}
