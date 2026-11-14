import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge must know HAVEN's custom font sizes (tailwind.config.js `fontSize`): otherwise it
// reads `text-label` or `text-title` as a text color and drops the real color (`text-foreground`).
// It must also know HAVEN's custom spacing and sizes (`h-touch`, `min-h-row`, `px-gutter`): otherwise
// a `className="h-touch"` would not replace a component default such as RNR Button's `h-10`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['gutter', 'section', 'sos-inset'],
    },
    classGroups: {
      h: [{ h: ['touch', 'row', 'button', 'touch-lg', 'sos'] }],
      w: [{ w: ['touch', 'touch-lg', 'sos'] }],
      'min-h': [
        {
          'min-h': [
            'touch',
            'row',
            'row-indicator',
            'row-settings',
            'button',
            'touch-lg',
            'triage',
            'sos',
          ],
        },
      ],
      'min-w': [{ 'min-w': ['touch', 'row', 'touch-lg', 'sos'] }],
      'font-size': [
        {
          text: [
            'micro',
            'caption',
            'body-sm',
            'title-sm',
            'display',
            'mono',
            'footnote',
            'body',
            'heading',
            'title',
            'large-title',
            'metric-sm',
            'metric',
            'metric-lg',
            'metric-xl',
            'label',
            'subtitle',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
