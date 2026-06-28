import type { ConceptType } from '@memoris/shared';

export const CONCEPT_TYPES: ConceptType[] = [
  'term',
  'phrase',
  'idiom',
  'collocation',
  'grammar',
  'idea',
];

/** Coerce a model-provided type string into a valid ConceptType. */
export function coerceConceptType(t: string | undefined): ConceptType {
  return CONCEPT_TYPES.includes(t as ConceptType) ? (t as ConceptType) : 'term';
}

/** Gemini structured-output schema for /v1/analyze (lowercase types are accepted). */
export const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    translation: { type: 'string' },
    gloss: { type: 'string' },
    proposedUnits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: CONCEPT_TYPES },
          gloss: { type: 'string' },
        },
        required: ['text', 'type', 'gloss'],
      },
    },
  },
  required: ['translation', 'gloss', 'proposedUnits'],
} as const;

/**
 * Prompt for the fast Tier-2 analyze step. Translate, gloss, and extract ONLY worth-remembering
 * units (terms, idioms, phrasal verbs, collocations, unusual grammar) — never everything, or the
 * memory fills with noise (docs/ARCHITECTURE.md §5).
 */
export function analyzePrompt(text: string, targetLanguage: string, context?: string): string {
  return [
    `You help a non-native English speaker working in English. Their native language code is "${targetLanguage}".`,
    `Translate the SELECTION into their native language, then give a one-line gloss in their native language.`,
    `Then extract the few worth-remembering units (jargon terms, idioms, phrasal verbs, collocations, unusual grammar).`,
    `Do NOT extract common easy words. If the selection is a single term, proposedUnits may contain just that term.`,
    context ? `\nSURROUNDING CONTEXT (for disambiguation only, do not translate it):\n${context}` : '',
    `\nSELECTION:\n${text}`,
  ]
    .filter(Boolean)
    .join('\n');
}
