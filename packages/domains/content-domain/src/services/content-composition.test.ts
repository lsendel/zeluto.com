import { describe, expect, it } from 'vitest';
import {
  buildTemplateContentModel,
  composeTemplateHtml,
  parseTemplateContentModel,
  selectExperimentVariant,
  type ContentExperiment,
} from './content-composition.js';

describe('content composition', () => {
  it('parses blocks and experiments from bodyJson model', () => {
    const model = parseTemplateContentModel({
      blocks: [
        { key: 'hero', html: '<h1>Hello</h1>' },
        { key: '', html: '<p>invalid</p>' },
      ],
      experiments: [
        {
          key: 'hero_copy_test',
          status: 'active',
          variants: [
            { key: 'a', weight: 50, blockOverrides: { hero: '<h1>A</h1>' } },
            { key: 'b', weight: 50, blockOverrides: { hero: '<h1>B</h1>' } },
          ],
        },
      ],
    });

    expect(model.blocks).toEqual([
      { key: 'hero', html: '<h1>Hello</h1>', text: null },
    ]);
    expect(model.experiments).toHaveLength(1);
    expect(model.experiments[0]?.key).toBe('hero_copy_test');
  });

  it('composes template html with block replacement and forced variant', () => {
    const result = composeTemplateHtml(
      '<section>{{block:hero}}</section><main>{{block:body}}</main>',
      {
        blocks: [
          { key: 'hero', html: '<h1>Default Hero</h1>' },
          { key: 'body', html: '<p>Body</p>' },
        ],
        experiments: [
          {
            key: 'hero_copy_test',
            status: 'active',
            variants: [
              {
                key: 'a',
                weight: 50,
                blockOverrides: { hero: '<h1>A Hero</h1>' },
              },
              {
                key: 'b',
                weight: 50,
                blockOverrides: { hero: '<h1>B Hero</h1>' },
              },
            ],
          },
        ],
      },
      {
        visitorId: 'visitor-1',
        forcedVariants: { hero_copy_test: 'b' },
      },
    );

    expect(result.html).toContain('<h1>B Hero</h1>');
    expect(result.html).toContain('<p>Body</p>');
    expect(result.appliedVariants).toEqual({ hero_copy_test: 'b' });
  });

  it('resolves shared blocks as base layer, template blocks override', () => {
    const result = composeTemplateHtml(
      '{{block:header}}|{{block:footer}}|{{block:cta}}',
      {
        blocks: [{ key: 'footer', html: '<footer>Template Footer</footer>' }],
        experiments: [],
      },
      {
        visitorId: 'v1',
        sharedBlocks: [
          { key: 'header', html: '<header>Shared Header</header>' },
          { key: 'footer', html: '<footer>Shared Footer</footer>' },
          { key: 'cta', html: '<a>Buy Now</a>' },
        ],
      },
    );

    expect(result.html).toContain('<header>Shared Header</header>');
    // Template-level footer overrides shared footer
    expect(result.html).toContain('<footer>Template Footer</footer>');
    expect(result.html).not.toContain('Shared Footer');
    expect(result.html).toContain('<a>Buy Now</a>');
  });

  it('selects deterministic variant for the same visitor', () => {
    const experiment: ContentExperiment = {
      key: 'subject_test',
      status: 'active',
      variants: [
        { key: 'a', weight: 30 },
        { key: 'b', weight: 70 },
      ],
    };

    const first = selectExperimentVariant(experiment, 'visitor-42');
    const second = selectExperimentVariant(experiment, 'visitor-42');
    expect(first?.key).toBe(second?.key);
  });

  it('merges model updates without dropping existing structures', () => {
    const next = buildTemplateContentModel(
      {
        blocks: [{ key: 'hero', html: '<h1>Hi</h1>' }],
        experiments: [
          { key: 'old', variants: [{ key: 'a', weight: 100 }] },
        ],
        arbitrary: true,
      },
      {
        experiments: [
          {
            key: 'new',
            variants: [
              { key: 'a', weight: 60 },
              { key: 'b', weight: 40 },
            ],
          },
        ],
      },
    );

    expect(next).toEqual({
      arbitrary: true,
      blocks: [{ key: 'hero', html: '<h1>Hi</h1>', text: null }],
      experiments: [
        {
          key: 'new',
          variants: [
            { key: 'a', weight: 60 },
            { key: 'b', weight: 40 },
          ],
        },
      ],
    });
  });

  it('skips paused experiments', () => {
    const result = composeTemplateHtml(
      '{{block:hero}}',
      {
        blocks: [{ key: 'hero', html: '<h1>Default</h1>' }],
        experiments: [
          {
            key: 'test',
            status: 'paused',
            variants: [
              {
                key: 'a',
                weight: 100,
                blockOverrides: { hero: '<h1>Override</h1>' },
              },
            ],
          },
        ],
      },
      { visitorId: 'v1' },
    );

    expect(result.html).toBe('<h1>Default</h1>');
    expect(result.appliedVariants).toEqual({});
  });
});
