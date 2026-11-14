import SwiftUI

extension Level {
    var color: Color {
        switch self {
        case .green: Theme.green
        case .amber: Theme.amber
        case .red: Theme.red
        case .pending: Theme.pending
        }
    }

    var background: Color {
        switch self {
        case .green: Theme.greenBackground
        case .amber: Theme.amberBackground
        case .red: Theme.redBackground
        case .pending: .clear
        }
    }

    var border: Color {
        switch self {
        case .green: Theme.greenBorder
        case .amber: Theme.amberBorder
        case .red: Theme.redBorder
        case .pending: Theme.pendingBorder
        }
    }

    var isDashed: Bool { self == .pending }

    var symbol: String {
        switch self {
        case .green: "circle.fill"
        case .amber: "circle.lefthalf.filled"
        case .red: "triangle.fill"
        case .pending: "circle.dashed"
        }
    }

    var glyph: String {
        switch self {
        case .green: "●"
        case .amber: "◐"
        case .red: "▲"
        case .pending: "○"
        }
    }

    var label: String {
        switch self {
        case .green: L("En rango", "In range")
        case .amber: L("Revisar", "Check")
        case .red: L("Emergencia", "Emergency")
        case .pending: L("Pendiente", "Pending")
        }
    }

    var action: String {
        switch self {
        case .green: L("Sigue con tu rutina", "Keep your routine")
        case .amber: L("Repite la medición o avisa a Tierra", "Re-measure or tell Earth")
        case .red: L("Abre el protocolo en el iPhone", "Open the protocol on iPhone")
        case .pending: L("Faltan mediciones", "Measurements missing")
        }
    }

    var meterSegments: Int {
        switch self {
        case .green: 1
        case .amber: 2
        case .red: 3
        case .pending: 0
        }
    }

    var severity: Int {
        switch self {
        case .green: 0
        case .pending: 1
        case .amber: 2
        case .red: 3
        }
    }

    var accessibilityDescription: String {
        "\(L("Nivel", "Level")): \(label). \(action)."
    }
}

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

struct LevelHero: View {
    let level: Level
    var detail: String?
    var showsMeter = true

    var body: some View {
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
