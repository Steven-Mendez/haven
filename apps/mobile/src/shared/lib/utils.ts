import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

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
