const { hairlineWidth } = require('nativewind/theme');

const v = (name) => `hsl(var(--${name}))`;

// Tokens «Vela 3»: haven/design/tokens.json (platformMap.mobile) → global.css. Docs: design/redesign/SPEC.md, apps/mobile/DISENO.md.
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: { DEFAULT: v('border'), subtle: v('border-subtle'), strong: v('border-strong') },
        input: v('input'),
        ring: v('ring'),
        background: v('background'),
        foreground: v('foreground'),
        surface: v('surface'),
        hover: v('hover'),
        active: v('active'),
        tertiary: v('text-tertiary'),
        disabled: v('text-disabled'),
        primary: { DEFAULT: v('primary'), foreground: v('primary-foreground') },
        secondary: { DEFAULT: v('secondary'), foreground: v('secondary-foreground') },
        destructive: { DEFAULT: v('destructive'), foreground: v('destructive-foreground') },
        muted: { DEFAULT: v('muted'), foreground: v('muted-foreground') },
        accent: { DEFAULT: v('accent'), foreground: v('accent-foreground') },
        popover: { DEFAULT: v('popover'), foreground: v('popover-foreground') },
        card: { DEFAULT: v('card'), foreground: v('card-foreground') },
        // «Ion» accent: focus, selection, links, progress, active tab. Never data or levels.
        brand: { DEFAULT: v('brand'), subtle: v('brand-subtle') },
        link: v('link'),
        elevated: v('elevated'),
        // Levels: text-level-amber · bg-level-amber-bg (12 %) · border-level-amber-border (24 %)
        level: {
          green: {
            DEFAULT: v('level-green'),
            bg: v('level-green-bg'),
            border: v('level-green-border'),
          },
          amber: {
            DEFAULT: v('level-amber'),
            bg: v('level-amber-bg'),
            border: v('level-amber-border'),
          },
          red: { DEFAULT: v('level-red'), bg: v('level-red-bg'), border: v('level-red-border') },
          pending: {
            DEFAULT: v('level-pending'),
            bg: v('level-pending-bg'),
            border: v('level-pending-border'),
          },
        },
        chart: {
          line: v('chart-line'),
          baseline: v('chart-baseline'),
          band: v('chart-band'),
          grid: v('chart-grid'),
          axis: v('chart-axis'),
          median: v('chart-median'),
          reference: v('chart-reference'),
          cursor: v('chart-cursor'),
        },
        'ring-done': v('ring-done'),
        'ring-track': v('ring-track'),
        'ring-partial': v('ring-partial'),
        // DEPRECATED: zone identity colours were removed (zones = name + icon). Neutral alias so
        // existing `*-zone-*` classes keep compiling; replace them with text-muted-foreground.
        zone: {
          heart: v('muted-foreground'),
          lungs: v('muted-foreground'),
          head: v('muted-foreground'),
          metabolism: v('muted-foreground'),
          musculoskeletal: v('muted-foreground'),
          skin: v('muted-foreground'),
          mind: v('muted-foreground'),
        },
      },
      // radius.*: xs 4 · sm 6 (chips) · md 8 (inputs) · lg 12 (groups) · xl 16 (sheets) · pill.
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        // DEPRECATED alias: old cards used 2xl (16); groups are lg (12) now.
        '2xl': '12px',
        pill: '9999px',
      },
      borderWidth: { hairline: hairlineWidth() },
      fontFamily: { mono: ['SF Mono', 'Menlo', 'monospace'] },
      // typography.scale.*.mobile — [size, line height]. Weights: 400/500/600; 700 only for
      // title, display and hero figures. Figures: add `tabular-nums`.
      fontSize: {
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.6px' }],
        caption: ['13px', { lineHeight: '18px' }],
        'body-sm': ['15px', { lineHeight: '20px' }],
        body: ['17px', { lineHeight: '22px' }],
        'title-sm': ['17px', { lineHeight: '22px' }],
        title: ['22px', { lineHeight: '28px', letterSpacing: '-0.3px' }],
        display: ['28px', { lineHeight: '34px', letterSpacing: '-0.4px' }],
        metric: ['44px', { lineHeight: '48px', letterSpacing: '-0.8px' }],
        'metric-xl': ['64px', { lineHeight: '68px', letterSpacing: '-1.4px' }],
        mono: ['12px', { lineHeight: '16px' }],
        // DEPRECATED aliases (v1/v2) mapped onto the v3 scale.
        footnote: ['15px', { lineHeight: '20px' }],
        heading: ['17px', { lineHeight: '22px' }],
        'large-title': ['28px', { lineHeight: '34px', letterSpacing: '-0.4px' }],
        'metric-sm': ['22px', { lineHeight: '28px', letterSpacing: '-0.3px' }],
        'metric-lg': ['44px', { lineHeight: '48px', letterSpacing: '-0.8px' }],
        label: ['13px', { lineHeight: '18px' }],
        subtitle: ['17px', { lineHeight: '22px' }],
      },
      // touch.mobile: min 44 · row 52 · indicator row 60 · settings row 44 · primary pill 52 · SOS 72
      minHeight: {
        touch: '44px',
        row: '52px',
        'row-indicator': '60px',
        'row-settings': '44px',
        button: '52px',
        'touch-lg': '60px',
        triage: '96px',
        sos: '72px',
      },
      minWidth: { touch: '44px', row: '52px', 'touch-lg': '60px', sos: '72px' },
      height: { touch: '44px', row: '52px', button: '52px', 'touch-lg': '60px', sos: '72px' },
      width: { touch: '44px', 'touch-lg': '60px', sos: '72px' },
      // space.layout.mobile: px-gutter (16) · gap-section (24) · pb-sos-inset (kept: 24)
      spacing: { gutter: '16px', section: '24px', 'sos-inset': '24px' },
      // motion.duration (fast/base/slow/press/enter/expand kept as deprecated aliases)
      transitionDuration: {
        micro: '100ms',
        standard: '160ms',
        enter: '240ms',
        figure: '400ms',
        fast: '100ms',
        base: '160ms',
        slow: '240ms',
        press: '100ms',
        expand: '240ms',
      },
      transitionTimingFunction: { standard: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  future: { hoverOnlyWhenSupported: true },
  plugins: [require('tailwindcss-animate')],
};
