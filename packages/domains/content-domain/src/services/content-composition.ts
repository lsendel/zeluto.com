/**
 * Content composition engine.
 *
 * Resolves `{{block:key}}` tokens in template HTML using a layered block system:
 * 1. Org-level shared blocks (base layer)
 * 2. Template-level blocks (override shared blocks on key conflict)
 * 3. Experiment variant overrides (highest priority)
 *
 * Experiment variants are assigned deterministically via FNV-1a hash bucketing
 * on (experimentKey, visitorId), ensuring the same visitor always sees the
 * same variant without server-side state.
 */

export interface ReusableContentBlock {
  key: string;
  html: string;
  text?: string | null;
}

export interface ExperimentVariant {
  key: string;
  weight: number;
  blockOverrides?: Record<string, string>;
}

export interface ContentExperiment {
  key: string;
  status?: 'draft' | 'active' | 'paused';
  variants: ExperimentVariant[];
}

export interface TemplateContentModel {
  blocks: ReusableContentBlock[];
  experiments: ContentExperiment[];
}

export interface CompositionResult {
  html: string;
  appliedVariants: Record<string, string>;
}

export interface CompositionOptions {
  visitorId: string;
  forcedVariants?: Record<string, string>;
  sharedBlocks?: ReusableContentBlock[];
}

const BLOCK_TOKEN_PATTERN = /\{\{\s*block:([a-zA-Z0-9_-]+)\s*\}\}/g;

export function parseTemplateContentModel(
  input: Record<string, unknown> | null | undefined,
): TemplateContentModel {
  const source = input ?? {};
  const rawBlocks = Array.isArray(source.blocks) ? source.blocks : [];
  const rawExperiments = Array.isArray(source.experiments)
    ? source.experiments
    : [];

  const blocks: ReusableContentBlock[] = [];
  for (const candidate of rawBlocks) {
    if (!isRecord(candidate)) continue;
    const key = nonEmptyString(candidate.key);
    const html = asString(candidate.html);
    if (!key || html === null) continue;
    blocks.push({ key, html, text: nullableString(candidate.text) });
  }

  const experiments: ContentExperiment[] = [];
  for (const candidate of rawExperiments) {
    if (!isRecord(candidate)) continue;
    const key = nonEmptyString(candidate.key);
    const variants = parseVariants(candidate.variants);
    if (!key || variants.length === 0) continue;
    experiments.push({
      key,
      status: parseStatus(candidate.status),
      variants,
    });
  }

  return { blocks, experiments };
}

export function buildTemplateContentModel(
  current: Record<string, unknown> | null | undefined,
  changes: Partial<TemplateContentModel>,
): Record<string, unknown> {
  const parsed = parseTemplateContentModel(current);
  return {
    ...(current ?? {}),
    blocks: changes.blocks ?? parsed.blocks,
    experiments: changes.experiments ?? parsed.experiments,
  };
}

export function composeTemplateHtml(
  templateHtml: string,
  model: TemplateContentModel,
  options: CompositionOptions,
): CompositionResult {
  // Layer 1: shared (org-level) blocks
  const blockMap = new Map<string, string>();
  if (options.sharedBlocks) {
    for (const block of options.sharedBlocks) {
      blockMap.set(block.key, block.html);
    }
  }

  // Layer 2: template-level blocks (override shared)
  for (const block of model.blocks) {
    blockMap.set(block.key, block.html);
  }

  // Layer 3: experiment variant overrides (highest priority)
  const appliedVariants: Record<string, string> = {};
  const overrideMap = new Map<string, string>();

  for (const experiment of model.experiments) {
    if (experiment.status && experiment.status !== 'active') continue;

    const selected = selectExperimentVariant(
      experiment,
      options.visitorId,
      options.forcedVariants?.[experiment.key],
    );
    if (!selected) continue;

    appliedVariants[experiment.key] = selected.key;
    for (const [blockKey, blockHtml] of Object.entries(
      selected.blockOverrides ?? {},
    )) {
      overrideMap.set(blockKey, blockHtml);
    }
  }

  const html = templateHtml.replace(
    BLOCK_TOKEN_PATTERN,
    (_match, tokenKey) => {
      const blockKey = String(tokenKey);
      if (overrideMap.has(blockKey)) return overrideMap.get(blockKey)!;
      return blockMap.get(blockKey) ?? '';
    },
  );

  return { html, appliedVariants };
}

export function selectExperimentVariant(
  experiment: ContentExperiment,
  visitorId: string,
  forcedVariantKey?: string,
): ExperimentVariant | null {
  const variants = experiment.variants.filter((v) => v.weight > 0);
  if (variants.length === 0) return null;

  if (forcedVariantKey) {
    const forced = variants.find((v) => v.key === forcedVariantKey);
    if (forced) return forced;
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight <= 0) return variants[0] ?? null;

  const normalized =
    (stableHash(`${experiment.key}:${visitorId}`) % 10000) / 10000;
  const bucket = normalized * totalWeight;

  let cursor = 0;
  for (const variant of variants) {
    cursor += variant.weight;
    if (bucket < cursor) return variant;
  }

  return variants[variants.length - 1] ?? null;
}

// --- Internal helpers ---

function parseVariants(value: unknown): ExperimentVariant[] {
  if (!Array.isArray(value)) return [];

  const variants: ExperimentVariant[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const key = nonEmptyString(candidate.key);
    const weight = parseWeight(candidate.weight);
    if (!key || weight <= 0) continue;
    variants.push({
      key,
      weight,
      blockOverrides: parseBlockOverrides(candidate.blockOverrides),
    });
  }
  return variants;
}

function parseWeight(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0)
    return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function parseBlockOverrides(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const overrides: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === 'string') overrides[key] = val;
  }
  return overrides;
}

function parseStatus(
  value: unknown,
): ContentExperiment['status'] | undefined {
  if (value === 'draft' || value === 'active' || value === 'paused')
    return value;
  return undefined;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 32-bit FNV-1a hash for deterministic experiment bucketing. */
function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
