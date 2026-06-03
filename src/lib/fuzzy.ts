/**
 * Dependency-free fzy/fzf-style fuzzy matcher used by the Cmd+P quick-open finder.
 *
 * `fuzzyMatch` scores a query against a target with a Smith-Waterman-style DP (ported from fzy's
 * `match.c`): it rewards consecutive runs, matches at word/separator boundaries (after `/ - _ .`,
 * space, or a camelCase hump), and matches in the basename over deep directory segments, while
 * penalizing gaps. It returns the matched character indices so the UI can highlight them, or
 * `null` when the query is not a subsequence of the target.
 */

export interface FuzzyMatch {
  /** Higher is better. Only comparable between matches against different targets. */
  score: number;
  /** Index in `target` of each matched query character, in order. */
  indices: number[];
}

const SCORE_MIN = -Infinity;
const SCORE_GAP_LEADING = -0.005;
const SCORE_GAP_TRAILING = -0.005;
const SCORE_GAP_INNER = -0.01;
const SCORE_MATCH_CONSECUTIVE = 1.0;
const SCORE_MATCH_SLASH = 0.9;
const SCORE_MATCH_WORD = 0.8;
const SCORE_MATCH_CAPITAL = 0.7;
const SCORE_MATCH_DOT = 0.6;

/** Beyond this target length the O(m·n) DP isn't worth it — fall back to a cheap greedy scorer. */
const MAX_DP_TARGET = 1024;

function isUpper(ch: string): boolean {
  return ch >= "A" && ch <= "Z";
}
function isLower(ch: string): boolean {
  return ch >= "a" && ch <= "z";
}

/** Boundary bonus for a target char given the char before it (uses original case for camelCase). */
function charBonus(prev: string, cur: string): number {
  if (prev === "/" || prev === "\\") return SCORE_MATCH_SLASH;
  if (prev === "-" || prev === "_" || prev === " ") return SCORE_MATCH_WORD;
  if (prev === ".") return SCORE_MATCH_DOT;
  if (isLower(prev) && isUpper(cur)) return SCORE_MATCH_CAPITAL;
  return 0;
}

/** Per-position boundary bonus; position 0 is treated as a boundary (like fzy). */
function computeBonus(target: string): number[] {
  const bonus = new Array<number>(target.length);
  let prev = "/";
  for (let i = 0; i < target.length; i++) {
    bonus[i] = charBonus(prev, target[i]);
    prev = target[i];
  }
  return bonus;
}

/** Cheap greedy scorer for pathologically long targets (leftmost matches + run/boundary bonus). */
function greedyMatch(ql: string, tl: string, target: string): FuzzyMatch {
  const bonus = computeBonus(target);
  const indices: number[] = [];
  let qi = 0;
  let score = 0;
  let prev = -2;
  for (let ti = 0; ti < tl.length && qi < ql.length; ti++) {
    if (tl[ti] === ql[qi]) {
      indices.push(ti);
      score += bonus[ti] + (ti === prev + 1 ? SCORE_MATCH_CONSECUTIVE : 0);
      prev = ti;
      qi++;
    }
  }
  return { score, indices };
}

export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (query.length === 0) return null;
  if (query.length > target.length) return null;

  const ql = query.toLowerCase();
  const tl = target.toLowerCase();

  // Fast subsequence reject.
  let qi = 0;
  for (let ti = 0; ti < tl.length && qi < ql.length; ti++) {
    if (tl[ti] === ql[qi]) qi++;
  }
  if (qi !== ql.length) return null;

  if (target.length > MAX_DP_TARGET) return greedyMatch(ql, tl, target);

  const m = query.length;
  const n = target.length;
  const bonus = computeBonus(target);

  // D[i][j]: best score for query[0..=i] ending with query[i] matched at target[j].
  // M[i][j]: best score for query[0..=i] over the prefix target[0..=j].
  const D: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(SCORE_MIN));
  const M: number[][] = Array.from({ length: m }, () => new Array<number>(n).fill(SCORE_MIN));

  for (let i = 0; i < m; i++) {
    let prevScore = SCORE_MIN;
    const gapScore = i === m - 1 ? SCORE_GAP_TRAILING : SCORE_GAP_INNER;
    for (let j = 0; j < n; j++) {
      if (ql[i] === tl[j]) {
        let score = SCORE_MIN;
        if (i === 0) {
          score = j * SCORE_GAP_LEADING + bonus[j];
        } else if (j > 0) {
          score = Math.max(M[i - 1][j - 1] + bonus[j], D[i - 1][j - 1] + SCORE_MATCH_CONSECUTIVE);
        }
        D[i][j] = score;
        prevScore = Math.max(score, prevScore + gapScore);
        M[i][j] = prevScore;
      } else {
        D[i][j] = SCORE_MIN;
        prevScore += gapScore;
        M[i][j] = prevScore;
      }
    }
  }

  const score = M[m - 1][n - 1];

  // Traceback: walk backwards picking the matched cell for each query char (fzy's algorithm).
  const indices = new Array<number>(m);
  let matchRequired = false;
  let j = n - 1;
  for (let i = m - 1; i >= 0; i--) {
    for (; j >= 0; j--) {
      if (D[i][j] !== SCORE_MIN && (matchRequired || D[i][j] === M[i][j])) {
        matchRequired =
          i > 0 && j > 0 && M[i][j] === D[i - 1][j - 1] + SCORE_MATCH_CONSECUTIVE;
        indices[i] = j;
        j--;
        break;
      }
    }
  }

  return { score, indices };
}

/** Scalar convenience: the score only, or `null` when there's no subsequence match. */
export function fuzzyScore(query: string, target: string): number | null {
  return fuzzyMatch(query, target)?.score ?? null;
}

/**
 * Rank `items` by fuzzy score against `key(item)`. An empty query returns the items unchanged
 * (the caller supplies its own empty-query ordering). Ties break toward the shorter target.
 */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  key: (item: T) => string,
): Array<{ item: T; match: FuzzyMatch }> {
  if (query.length === 0) {
    return items.map((item) => ({ item, match: { score: 0, indices: [] } }));
  }
  const scored: Array<{ item: T; match: FuzzyMatch; len: number }> = [];
  for (const item of items) {
    const k = key(item);
    const match = fuzzyMatch(query, k);
    if (match) scored.push({ item, match, len: k.length });
  }
  scored.sort((a, b) => b.match.score - a.match.score || a.len - b.len);
  return scored.map(({ item, match }) => ({ item, match }));
}
