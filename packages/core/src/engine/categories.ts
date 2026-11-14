// Numeric codes for category indicators (e.g. heart rhythm) so they can be charted and stored as numbers:
// the value is an index into each list. Product logic, also used by the test data scenarios.
/**
 * Numeric codes for category indicators (the value is an index into the list). `symptom` series use the glossary symptom ids.
 */
export const CATEGORY_CODES: Record<string, readonly string[]> = {
  'heart-rhythm': ['sinus', 'irregular'],
  symptom: [
    'none',
    'chest-pain',
    'shortness-of-breath',
    'dizziness',
    'fainting',
    'blurred-vision',
    'confusion',
    'nausea',
    'fever-chills',
    'sweating',
    'palpitations',
  ],
};
