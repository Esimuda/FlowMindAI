import type { MemoryEntry, MemoryType } from "@/lib/types";
import { saveMemoryEntry, loadMemoryEntries } from "@/lib/db/memory";

// ── Keyword extraction ────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "from","is","are","was","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","must","shall",
  "not","no","it","its","this","that","these","those","i","we","you","he",
  "she","they","my","your","our","their","what","when","where","how","which",
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  Array.from(a).forEach((w) => { if (b.has(w)) intersection++; });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Decay relevance by age: full weight up to 7 days, then exponential decay
function ageDecayFactor(updatedAt?: number): number {
  if (!updatedAt) return 0.5;
  const ageDays = (Date.now() - updatedAt) / 86_400_000;
  if (ageDays <= 7) return 1.0;
  return Math.max(0.1, Math.exp(-0.05 * (ageDays - 7)));
}

function entryText(entry: MemoryEntry): string {
  const v = entry.value;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return entry.key;
}

// ── MemoryManager ─────────────────────────────────────────────────────────────

export class MemoryManager {
  private shortTerm: Map<string, unknown> = new Map();
  private longTermCache: MemoryEntry[] = [];
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async init(): Promise<void> {
    try {
      this.longTermCache = await loadMemoryEntries(this.userId, "long_term");
      const patterns = await loadMemoryEntries(this.userId, "pattern");
      this.longTermCache.push(...patterns);
    } catch {
      // Non-fatal — memory unavailable
    }
  }

  setShortTerm(key: string, value: unknown): void {
    this.shortTerm.set(key, value);
  }

  getShortTerm<T = unknown>(key: string): T | undefined {
    return this.shortTerm.get(key) as T | undefined;
  }

  async saveLongTerm(key: string, value: unknown, relevance = 0.8): Promise<void> {
    const entry: MemoryEntry = { type: "long_term", key, value, relevance };
    try {
      await saveMemoryEntry(this.userId, entry);
    } catch {
      // Non-fatal
    }
    this.longTermCache = this.longTermCache.filter((e) => !(e.key === key && e.type === "long_term"));
    this.longTermCache.push({ ...entry, updatedAt: Date.now() });
  }

  async savePattern(key: string, pattern: unknown): Promise<void> {
    const entry: MemoryEntry = { type: "pattern", key, value: pattern, relevance: 1.0 };
    try {
      await saveMemoryEntry(this.userId, entry);
    } catch {
      // Non-fatal
    }
    this.longTermCache = this.longTermCache.filter((e) => !(e.key === key && e.type === "pattern"));
    this.longTermCache.push({ ...entry, updatedAt: Date.now() });
  }

  getLongTerm(key?: string): MemoryEntry[] {
    const lt = this.longTermCache.filter((e) => e.type === "long_term");
    return key ? lt.filter((e) => e.key === key) : lt;
  }

  getPatterns(): MemoryEntry[] {
    return this.longTermCache.filter((e) => e.type === "pattern");
  }

  // Returns the topK most relevant memories for a given goal using
  // keyword overlap (Jaccard) × base relevance × time-decay.
  searchRelevant(goal: string, topK = 5): MemoryEntry[] {
    if (this.longTermCache.length === 0) return [];
    const goalKeywords = extractKeywords(goal);

    return this.longTermCache
      .map((entry) => {
        const entryKeywords = extractKeywords(entryText(entry));
        const similarity = jaccardSimilarity(goalKeywords, entryKeywords);
        const decay = ageDecayFactor(entry.updatedAt);
        const score = similarity * entry.relevance * decay;
        return { entry, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ entry }) => entry);
  }

  // Deduplicate patterns with the same key, keeping highest-relevance.
  deduplicatePatterns(): void {
    const seen = new Map<string, MemoryEntry>();
    for (const entry of this.longTermCache) {
      const existing = seen.get(entry.key);
      if (!existing || entry.relevance > existing.relevance) {
        seen.set(entry.key, entry);
      }
    }
    this.longTermCache = Array.from(seen.values());
  }

  snapshot(): { shortTerm: Record<string, unknown>; longTerm: MemoryEntry[] } {
    return {
      shortTerm: Object.fromEntries(this.shortTerm),
      longTerm: this.longTermCache,
    };
  }
}
