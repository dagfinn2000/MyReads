import {
  MAX_TAG_RULES,
  TAG_RULE_MAX,
  normalizeRuleTag,
  type ImportTagsMode,
  type TagRename,
} from "@/lib/preferences";

/**
 * What happens to a catalogue's subjects on the way into the tags field:
 * the reader's renames and "never import" list (Manage tags can add to
 * both), then the import mode from Preferences. Pure, so the add form, the
 * shelf scan and the edit page's lookup all apply the same rules.
 *
 * Only catalogue subjects go through here. Tags typed into the form are the
 * reader's own and are never rewritten.
 */

export type TagRules = { renames: TagRename[]; skips: string[] };

export type TagImportSettings = {
  mode: ImportTagsMode;
  rules: TagRules;
  /** The library's tags, for mode "known" (empty otherwise). */
  knownTags: string[];
};

/** Rename hops followed before giving up, in case stored rules loop. */
const MAX_RENAME_HOPS = 10;

/**
 * Catalogue subjects as tags: each subject split on commas (the form would
 * split "Fiction, General" into two tags anyway), trimmed, lower case,
 * deduped. Anything longer than a tag may be is dropped.
 */
export function splitCatalogueSubjects(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const subject of raw) {
    for (const part of subject.split(",")) {
      const tag = part.trim().toLowerCase();
      if (tag && tag.length <= TAG_RULE_MAX && !out.includes(tag)) out.push(tag);
    }
  }
  return out;
}

/** Renames followed (a chain too, stopping at a loop), skipped tags
 *  dropped both before and after renaming, then deduped. */
export function applyTagRules(tags: readonly string[], rules: TagRules): string[] {
  const renames = new Map(rules.renames.map((r) => [r.from, r.to]));
  const skips = new Set(rules.skips);
  const out: string[] = [];
  for (const tag of tags) {
    if (skips.has(tag)) continue;
    let name = tag;
    const seen = new Set([name]);
    for (let hop = 0; hop < MAX_RENAME_HOPS; hop++) {
      const next = renames.get(name);
      if (!next || seen.has(next)) break;
      seen.add(next);
      name = next;
    }
    if (!skips.has(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

/** The tags a catalogue's subjects become under the reader's settings. */
export function catalogueTags(raw: readonly string[], settings: TagImportSettings): string[] {
  if (settings.mode === "off") return [];
  const tags = applyTagRules(splitCatalogueSubjects(raw), settings.rules);
  if (settings.mode === "all") return tags;
  const known = new Set(settings.knownTags.map((t) => t.toLowerCase()));
  return tags.filter((t) => known.has(t));
}

/**
 * The rules with "always rename `from` to `to`" added. Replaces an older
 * rule for `from`, points rules that led to `from` at `to` instead (so
 * renaming A to B, then B to C, leaves A to C), drops a rule from `to` back
 * to `from` (it would loop), and takes both names off the skip list: the
 * reader just asked for `to`. Unchanged when either name can't be a tag.
 */
export function withRenameRule(rules: TagRules, rawFrom: string, rawTo: string): TagRules {
  const from = normalizeRuleTag(rawFrom);
  const to = normalizeRuleTag(rawTo);
  if (!from || !to || from === to) return rules;
  const renames = rules.renames
    .filter((r) => r.from !== from && !(r.from === to && r.to === from))
    .map((r) => (r.to === from ? { ...r, to } : r))
    .filter((r) => r.from !== r.to);
  return {
    renames: [...renames, { from, to }].slice(-MAX_TAG_RULES),
    skips: rules.skips.filter((s) => s !== from && s !== to),
  };
}

/** The rules with "never import `tag`" added, replacing a rename rule for
 *  it. Unchanged when the name can't be a tag. */
export function withSkipRule(rules: TagRules, rawTag: string): TagRules {
  const tag = normalizeRuleTag(rawTag);
  if (!tag) return rules;
  return {
    renames: rules.renames.filter((r) => r.from !== tag),
    skips: [...rules.skips.filter((s) => s !== tag), tag].slice(-MAX_TAG_RULES),
  };
}

/** The rules without the rename rule for `from` and/or the skip of `skip`. */
export function withoutRule(rules: TagRules, rule: { from?: string; skip?: string }): TagRules {
  return {
    renames: rules.renames.filter((r) => r.from !== rule.from),
    skips: rules.skips.filter((s) => s !== rule.skip),
  };
}
