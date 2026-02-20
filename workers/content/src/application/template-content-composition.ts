import {
  buildTemplateContentModel,
  type ContentExperiment,
  composeTemplateHtml,
  parseTemplateContentModel,
  type ReusableContentBlock,
} from '@mauntic/content-domain';

export interface TemplateCompositionPreviewInput {
  templateId: string;
  bodyHtml: string | null;
  bodyText: string | null;
  bodyJson: unknown;
  visitorId?: string;
  forcedVariants?: Record<string, string>;
  sharedBlocks?: unknown;
}

export interface TemplateCompositionPreviewResult {
  html: string;
  text: string | undefined;
  appliedVariants: Record<string, string>;
  blocks: ReusableContentBlock[];
  experiments: ContentExperiment[];
}

export function buildTemplateCompositionPreview(
  input: TemplateCompositionPreviewInput,
): TemplateCompositionPreviewResult {
  const sourceBodyJson = asRecord(input.bodyJson);
  const model = parseTemplateContentModel(sourceBodyJson);
  const sharedBlocks = parseTemplateContentModel({
    blocks: Array.isArray(input.sharedBlocks) ? input.sharedBlocks : [],
  }).blocks;
  const mergedBlocks = mergeBlocks(sharedBlocks, model.blocks);

  const composition = composeTemplateHtml(
    input.bodyHtml ?? '',
    {
      ...model,
      blocks: mergedBlocks,
    },
    {
      visitorId: input.visitorId ?? `preview:${input.templateId}`,
      forcedVariants: input.forcedVariants,
    },
  );

  return {
    html: composition.html,
    text: input.bodyText ?? undefined,
    appliedVariants: composition.appliedVariants,
    blocks: model.blocks,
    experiments: model.experiments,
  };
}

export function upsertTemplateBlockBodyJson(
  currentBodyJson: unknown,
  block: {
    key: string;
    html: string;
    text?: string | null;
  },
): Record<string, unknown> {
  const parsed = parseTemplateContentModel(asRecord(currentBodyJson));
  const nextBlocks = parsed.blocks.filter(
    (candidate) => candidate.key !== block.key,
  );
  nextBlocks.push({
    key: block.key,
    html: block.html,
    text: block.text ?? null,
  });

  return buildTemplateContentModel(asRecord(currentBodyJson), {
    blocks: nextBlocks,
  });
}

export function deleteTemplateBlockBodyJson(
  currentBodyJson: unknown,
  blockKey: string,
): Record<string, unknown> {
  const parsed = parseTemplateContentModel(asRecord(currentBodyJson));
  const nextBlocks = parsed.blocks.filter(
    (candidate) => candidate.key !== blockKey,
  );
  return buildTemplateContentModel(asRecord(currentBodyJson), {
    blocks: nextBlocks,
  });
}

export function upsertTemplateExperimentBodyJson(
  currentBodyJson: unknown,
  experimentInput: unknown,
): { bodyJson: Record<string, unknown>; experiment: ContentExperiment | null } {
  const parsedExisting = parseTemplateContentModel(asRecord(currentBodyJson));
  const parsedIncoming = parseTemplateContentModel({
    experiments: [experimentInput],
  });
  const experiment = parsedIncoming.experiments[0] ?? null;
  if (!experiment) {
    return {
      bodyJson: buildTemplateContentModel(asRecord(currentBodyJson), {
        experiments: parsedExisting.experiments,
      }),
      experiment: null,
    };
  }

  const nextExperiments = parsedExisting.experiments.filter(
    (candidate) => candidate.key !== experiment.key,
  );
  nextExperiments.push(experiment);

  return {
    bodyJson: buildTemplateContentModel(asRecord(currentBodyJson), {
      experiments: nextExperiments,
    }),
    experiment,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mergeBlocks(
  sharedBlocks: ReusableContentBlock[],
  templateBlocks: ReusableContentBlock[],
): ReusableContentBlock[] {
  const merged = new Map<string, ReusableContentBlock>();
  for (const block of sharedBlocks) {
    merged.set(block.key, block);
  }
  for (const block of templateBlocks) {
    merged.set(block.key, block);
  }
  return [...merged.values()];
}
