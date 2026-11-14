import SwiftUI

// Watch theme («Vela 3», X / Linear / Grok direction). Source of truth: haven/design/redesign/SPEC.md (§2 colour,
// §3 type, §4 sizes, §5 motion). Usage spec: targets/watch/DISENO.md. The complication keeps a hand-synced copy in
// targets/watch-widget/WidgetTheme.swift: change both together.
// Screens never use loose colours or sizes: everything comes from here.
enum Theme {
    // MARK: Surfaces (pure black, no filled cards: separation is hairlines and space)

    static let background = Color(hex: 0x000000)  // background
    /// Grouped content (almost invisible on black). Most groups use a hairline and no fill at all.
    static let card = Color(hex: 0x0F0F11)  // card
    /// Sheets, the secondary button fill, crew notices.
    static let elevated = Color(hex: 0x16161A)  // elevated
    /// Ring and meter tracks, skeletons.
    static let muted = Color(hex: 0x1C1C20)  // muted
    /// Kept for source compatibility: the secondary button fill (= `elevated`).
    static let secondary = elevated

    // MARK: Lines

    static let borderSubtle = Color(hex: 0x16161A)  // border-subtle: inner separators
    /// Standard 1 pt hairline (cards, rows, the offline notice).
    static let border = Color(hex: 0x232327)  // border
    /// Control outlines (secondary/outline buttons, pending dashes). Hairline-only affordances are too thin on the
    /// watch, so controls always use the strong line.
    static let borderStrong = Color(hex: 0x2F3336)  // border-strong
    /// Kept for source compatibility (= `borderStrong`).
    static let input = borderStrong

    // MARK: Text

    static let foreground = Color(hex: 0xECECEE)  // foreground
    /// Labels, metadata, data age (8:1 on black).
    static let mutedForeground = Color(hex: 0x9B9BA3)  // secondary
    /// Units, timestamps. Never for a value that matters. SPEC v3.1: raised to #80808A for AA at 12 px.
    static let tertiary = Color(hex: 0x80808A)  // tertiary
    static let disabled = Color(hex: 0x45454C)  // disabled

    // MARK: Actions

    /// Primary button: white pill with black text (X, Grok). One per screen.
    static let primary = Color(hex: 0xF4F4F5)
    static let primaryForeground = Color(hex: 0x000000)
    /// Apple system blue (SPEC v3.1): focus, selection, progress (mood scale). Never on buttons, levels or health data.
    static let accent = Color(hex: 0x0A84FF)
    static let accentSubtle = Color(hex: 0x0A84FF).opacity(0.14)
    static let accentForeground = Color(hex: 0x000000)
    static let ring = accent
    /// SOS and «Open protocol» fills only (Apple system red, SPEC v3.1).
    static let destructive = Color(hex: 0xFF453A)
    static let destructiveForeground = Color(hex: 0xFFFFFF)

    // MARK: Levels (always with shape and label: ● ◐ ▲ ○, see Level.swift)
    // SPEC v3.1: Apple system colours, vivid on black. Keep targets/watch-widget/WidgetTheme.swift in sync.

    static let green = Color(hex: 0x30D158)  // ok
    static let amber = Color(hex: 0xFF9F0A)  // check
    static let red = Color(hex: 0xFF453A)  // emergency
    /// Neutral grey, never green-looking. Drawn with a dashed outline and no fill.
    static let pending = Color(hex: 0x8E8E93)

    /// Level tints: at most 12 % behind and 24 % on the outline. A whole card is never filled.
    static let greenBackground = green.opacity(0.12)
    static let amberBackground = amber.opacity(0.12)
    static let redBackground = red.opacity(0.12)
    static let greenBorder = green.opacity(0.24)
    static let amberBorder = amber.opacity(0.24)
    static let redBorder = red.opacity(0.24)
    static let pendingBorder = borderStrong

    // MARK: Mission disc (same as Earth's `--ring-*` dark): progress only, never health. Flat cyan / blue /
    // violet that never read as a level; unlit segments are the same hue at 20 %.

    /// Routine of the day (actions done / total).
    static let ring1 = Color(hex: 0x4FD2EC)
    /// Measurements of the day (readings taken / planned).
    static let ring2 = Color(hex: 0x6B93FF)
    /// Wellbeing (check-in + cognitive battery).
    static let ring3 = Color(hex: 0xB88CFF)
    static let ringTrackOpacity: Double = 0.2

    // MARK: Radii (SPEC §4)

    static let radiusSmall: CGFloat = 6  // chips, meter segments
    static let radius: CGFloat = 12  // hairline groups (buttons are pills)

    // MARK: Sizes

    /// Minimum tap target and list row height (SPEC §4: ≥ 44 on the watch).
    static let tapTarget: CGFloat = 44
    /// Every full-width pill button: 44 pt (SPEC §4).
    static let tapTargetLarge: CGFloat = 44
    /// SOS pill height (toolbar-less contexts). The SOS page itself uses the hold ring (`HoldToConfirm`).
    static let tapTargetSOS: CGFloat = 56
    /// Stroke of progress rings (Countdown, LevelRing).
    static let ringWidth: CGFloat = 6
    /// Stroke of the SOS hold ring.
    static let holdRingWidth: CGFloat = 8
    /// Height of a level meter segment.
    static let meterHeight: CGFloat = 4

    // MARK: Rounded display corners (every case size, Ultra 49 mm included)
    // watchOS has no bottom safe area: whatever touches the bottom edge (or the fold of the first view) is clipped by
    // the rounded display corners. See `.havenScreen()` and `.aboveTheFold()` (Components.swift) and DISENO.md §2.1.

    /// Horizontal screen margin for every page.
    static let screenMargin: CGFloat = Spacing.m
    /// Space kept free above the bottom edge and above the fold.
    static let cornerInset: CGFloat = 24
    /// Space below the first view, outside its minimum height (`containerRelativeFrame` reports ≈ 30 pt short inside
    /// a page ScrollView on watchOS).
    static let foldGap: CGFloat = 40
    /// Extra horizontal inset of full-width pills, so their round ends stay off the display corners.
    static let capsuleInset: CGFloat = Spacing.s
}

// MARK: - Spacing (4 pt grid; the watch rarely goes past 16)

enum Spacing {
    static let xs: CGFloat = 2
    static let s: CGFloat = 4
    static let m: CGFloat = 8
    static let l: CGFloat = 12
    static let xl: CGFloat = 16
    static let xxl: CGFloat = 24
}

// MARK: - Typography

/// SF Compact (default design, no `.rounded`), weights 400/500/600, digits always tabular (`.monospacedDigit()`).
/// Text roles use system text styles so they follow Dynamic Type; at the default size they land on the SPEC watch
/// column (caption 13, body 15/17, title 20, display 24). Figures use fixed sizes (metric 40, metric-xl 56): pair
/// them with `.minimumScaleFactor` so they never clip.
enum Typography {
    /// Caps section label (with `.textCase(.uppercase)` and `.tracking(0.6)`).
    static let micro = Font.footnote.weight(.medium).monospacedDigit()
    /// Timestamps, units, metadata (≈ 13).
    static let caption = Font.footnote.monospacedDigit()
    /// Secondary lines and the action under a level (≈ 13–14). Kept name from the previous theme.
    static let label = Font.footnote.monospacedDigit()
    /// UI text (≈ 15).
    static let bodySmall = Font.caption2.monospacedDigit()
    /// Body (≈ 16–17).
    static let body = Font.body.monospacedDigit()
    /// Button labels (≈ 17 / 600).
    static let button = Font.headline.monospacedDigit()
    /// Small title, questions (≈ 17 / 600).
    static let titleSmall = Font.headline.monospacedDigit()
    /// Screen title, level word (≈ 20 / 600).
    static let title = Font.title3.weight(.semibold).monospacedDigit()
    /// Display (≈ 24 / 600).
    static let display = Font.title2.weight(.semibold).monospacedDigit()
    /// Figure, 40 / 600: status heart rate, countdown.
    static let metric = Font.system(size: 40, weight: .semibold).monospacedDigit()
    /// Hero figure, 56 / 600: monitor heart rate, mood echo.
    static let metricXL = Font.system(size: 56, weight: .semibold).monospacedDigit()
    /// IDs, timers (12).
    static let mono = Font.system(size: 12, weight: .medium, design: .monospaced)
    /// Kept names from the previous theme.
    static let figure = metricXL
    static let figureMedium = metric
}

// MARK: - Motion (SPEC §5)

/// Durations in seconds: micro 100, standard 160, enter 240, figures 400. Curve `cubic-bezier(0.16, 1, 0.3, 1)`.
/// Only «Live» and an unacknowledged emergency pulse. With Reduce Motion: opacity only, no pulse.
enum Motion {
    static let micro: Double = 0.1
    static let standard: Double = 0.16
    static let enter: Double = 0.24
    static let figure: Double = 0.4
    /// Kept names from the previous theme.
    static let press: Double = micro
    static let expand: Double = enter

    /// The house curve with a given duration.
    static func curve(_ duration: Double = standard) -> Animation {
        .timingCurve(0.16, 1, 0.3, 1, duration: duration)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
