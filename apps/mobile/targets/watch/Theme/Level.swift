import SwiftUI

// Three levels plus pending (SPEC.md §2 «Niveles»). Rule: never colour alone. Each level has a shape and a label, the
// same on phone, web and watch: ● In range · ◐ Check · ▲ Emergency · ○ Pending (dashed).
// The text carries the colour; a background is at most a 12 % tint and an outline 24 %. «Pending» never looks green.
// `Level` is defined in Contract/Contract.swift (W00); this file only styles it.

extension Level {
    /// Text, icon and stroke color (`level.X.fg`).
    var color: Color {
        switch self {
        case .green: Theme.green
        case .amber: Theme.amber
        case .red: Theme.red
        case .pending: Theme.pending
        }
    }

    /// 12 % tint (`level.X.bg`). Pending has no fill.
    var background: Color {
        switch self {
        case .green: Theme.greenBackground
        case .amber: Theme.amberBackground
        case .red: Theme.redBackground
        case .pending: .clear
        }
    }

    /// 24 % outline (`level.X.border`). Pending's is drawn dashed (`isDashed`).
    var border: Color {
        switch self {
        case .green: Theme.greenBorder
        case .amber: Theme.amberBorder
        case .red: Theme.redBorder
        case .pending: Theme.pendingBorder
        }
    }

    /// Only pending uses a dashed outline (and «no recent data», which reuses it).
    var isDashed: Bool { self == .pending }

    /// SF Symbol for the level (`level.symbol.X.sfSymbol`).
    var symbol: String {
        switch self {
        case .green: "circle.fill"
        case .amber: "circle.lefthalf.filled"
        case .red: "triangle.fill"
        case .pending: "circle.dashed"
        }
    }

    /// Text glyph equivalent, for strings and accessibility.
    var glyph: String {
        switch self {
        case .green: "●"
        case .amber: "◐"
        case .red: "▲"
        case .pending: "○"
        }
    }

    /// Unified label (`level.label`), identical on the three platforms.
    var label: String {
        switch self {
        case .green: L("En rango", "In range")
        case .amber: L("Revisar", "Check")
        case .red: L("Emergencia", "Emergency")
        case .pending: L("Pendiente", "Pending")
        }
    }

    /// What to do, in one line (status hero).
    var action: String {
        switch self {
        case .green: L("Sigue con tu rutina", "Keep your routine")
        case .amber: L("Repite la medición o avisa a Tierra", "Re-measure or tell Earth")
        case .red: L("Abre el protocolo en el iPhone", "Open the protocol on iPhone")
        case .pending: L("Faltan mediciones", "Measurements missing")
        }
    }

    /// Lit segments of the 3-segment meter: in range 1, check 2, emergency 3, pending 0 (dashed, unlit).
    var meterSegments: Int {
        switch self {
        case .green: 1
        case .amber: 2
        case .red: 3
        case .pending: 0
        }
    }

    /// Severity (`level.severity`): green 0 < pending 1 < amber 2 < red 3. Pending is never treated as «fine».
    var severity: Int {
        switch self {
        case .green: 0
        case .pending: 1
        case .amber: 2
        case .red: 3
        }
    }

    /// «Nivel: Revisar. Repite la medición o avisa a Tierra.»
    var accessibilityDescription: String {
        "\(L("Nivel", "Level")): \(label). \(action)."
    }
}

// MARK: - Badge

/// Capsule badge: sentence case, weight 500, 12 % level tint and 24 % outline; pending has no fill and a dashed
/// outline. With a `level` it shows the shape and label (`text` replaces the label, never the shape); without one it
/// is a neutral hairline chip (`LevelBadge(text: "Tripulación")`).
struct LevelBadge: View {
    var level: Level?
    var text: String?

    init(level: Level, text: String? = nil) {
        self.level = level
        self.text = text
    }

    init(text: String) {
        self.level = nil
        self.text = text
    }

    var body: some View {
        HStack(spacing: Spacing.s) {
            if let level {
                Image(systemName: level.symbol)
                    .font(.system(size: 9, weight: .semibold))
            }
            Text(text ?? level?.label ?? "")
                .font(Typography.caption.weight(.medium))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, Spacing.m)
        .frame(minHeight: 22)
        .foregroundStyle(level?.color ?? Theme.mutedForeground)
        .background(level?.background ?? .clear, in: Capsule())
        .overlay {
            Capsule().strokeBorder(
                level?.border ?? Theme.border,
                style: StrokeStyle(lineWidth: 1, dash: level?.isDashed == true ? [3, 2] : [])
            )
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibleLabel)
    }

    private var accessibleLabel: String {
        guard let level else { return text ?? "" }
        return "\(text.map { "\($0). " } ?? "")\(level.accessibilityDescription)"
    }
}

// MARK: - Level meter

/// 3-segment level meter (SPEC §1.4, §6 «Reloj»): the segments light up to the level in its colour (in range 1,
/// check 2, emergency 3) over the `Theme.muted` track; pending lights none and dashes all three. Decorative: the
/// label next to it carries the meaning, so it is hidden from VoiceOver.
struct LevelMeter: View {
    let level: Level
    var height: CGFloat = Theme.meterHeight

    var body: some View {
        HStack(spacing: Spacing.s) {
            ForEach(0..<3, id: \.self) { index in
                segment(lit: index < level.meterSegments)
            }
        }
        .frame(height: height)
        .animation(Motion.curve(Motion.enter), value: level)
        .accessibilityHidden(true)
    }

    @ViewBuilder private func segment(lit: Bool) -> some View {
        let shape = RoundedRectangle(cornerRadius: height / 2)
        if level.isDashed {
            shape.strokeBorder(Theme.pendingBorder, style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
        } else {
            shape.fill(lit ? level.color : Theme.muted)
        }
    }
}

// MARK: - Status hero

/// Status hero: shape + level word (title, in the level colour), the 3-segment meter and the action in one grey
/// line. Replaces any ring as the main element of the status screen (W01).
struct LevelHero: View {
    let level: Level
    /// Replaces `level.action` (e.g. a message from the phone). The label and shape never change.
    var detail: String?
    var showsMeter = true

    var body: some View {
        // Tight (4 pt): with a two-line action (amber) the Status pill must still fit above the fold (Ultra 49 mm QA).
        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s + Spacing.xs) {
                Image(systemName: level.symbol)
                    .font(.system(size: 13, weight: .semibold))
                Text(level.label)
                    .font(Typography.title)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .foregroundStyle(level.color)
            if showsMeter {
                LevelMeter(level: level)
            }
            Text(detail ?? level.action)
                .font(Typography.label)
                .foregroundStyle(Theme.mutedForeground)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibleLabel)
    }

    private var accessibleLabel: String {
        guard let detail else { return level.accessibilityDescription }
        return "\(L("Nivel", "Level")): \(level.label). \(detail)."
    }
}

// MARK: - Progress ring

/// Monochrome progress ring (§3.4): the done part uses the text color and the track `Theme.muted`. Rings measure
/// progress only (day actions, a gauge), never health: the level is shown with `LevelHero` or `LevelBadge`.
/// `level` is kept for source compatibility and ignored. The default center shows the percentage.
struct LevelRing<Center: View>: View {
    var level: Level?
    var progress: Double = 1
    var lineWidth: CGFloat = Theme.ringWidth
    @ViewBuilder var center: () -> Center

    var body: some View {
        ZStack {
            Circle().stroke(Theme.muted, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: clampedProgress)
                .stroke(Theme.foreground, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            center()
                .padding(lineWidth + Spacing.s)
        }
        .accessibilityElement(children: .combine)
    }

    private var clampedProgress: Double { min(max(progress, 0), 1) }
}

extension LevelRing where Center == LevelRingCenter {
    init(level: Level? = nil, progress: Double = 1, lineWidth: CGFloat = Theme.ringWidth) {
        self.init(level: level, progress: progress, lineWidth: lineWidth) {
            LevelRingCenter(level: level, progress: progress)
        }
    }
}

/// Default ring center: the progress as a percentage (`level` is ignored, kept for compatibility).
struct LevelRingCenter: View {
    var level: Level?
    var progress: Double = 1

    var body: some View {
        Text("\(Int((min(max(progress, 0), 1) * 100).rounded())) %")
            .font(Typography.label.weight(.medium).monospacedDigit())
            .foregroundStyle(Theme.foreground)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}

#Preview("Levels") {
    ScrollView {
        VStack(alignment: .leading, spacing: Spacing.m) {
            ForEach([Level.green, .amber, .red, .pending], id: \.self) { level in
                LevelHero(level: level)
                LevelBadge(level: level)
            }
            LevelMeter(level: .amber)
            LevelBadge(text: "W03")
            LevelRing(progress: 5.0 / 7.0).frame(width: 56, height: 56)
        }
    }
    .background(Theme.background)
}
