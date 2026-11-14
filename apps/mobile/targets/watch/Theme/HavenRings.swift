import SwiftUI

struct HavenRing: Identifiable, Equatable {
    enum Kind: Int, CaseIterable {
        case routine, measurements, wellbeing
    }

    let kind: Kind
    let done: Int
    let total: Int

    var id: Kind { kind }
}

extension HavenRing.Kind {
    var color: Color {
        switch self {
        case .routine: Theme.ring1
        case .measurements: Theme.ring2
        case .wellbeing: Theme.ring3
        }
    }

    var label: String {
        switch self {
        case .routine: L("Rutina", "Routine")
        case .measurements: L("Mediciones", "Measurements")
        case .wellbeing: L("Bienestar", "Wellbeing")
        }
    }
}

struct HavenRings: View {
    let rings: [HavenRing]
    var diameter: CGFloat = 72
    var centerText: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var lineWidth: CGFloat { max(2.5, (diameter * 0.12).rounded()) }
    private var radius: CGFloat { (diameter - lineWidth) / 2 }

    private func gap(_ points: CGFloat) -> Double { Double(points / (2 * .pi * radius)) }

    var body: some View {
        let shown = Array(rings.prefix(3))
        let span = 1.0 / Double(max(shown.count, 1))
        let sectorGap = shown.count > 1 ? gap(max(2, diameter * 0.05)) : 0
        let segmentGap = gap(max(1, diameter * 0.018))
        ZStack {
            ForEach(Array(shown.enumerated()), id: \.element.id) { index, ring in
                Sector(
                    ring: ring,
                    from: Double(index) * span + sectorGap / 2,
                    to: Double(index + 1) * span - sectorGap / 2,
                    segmentGap: diameter < 32 ? nil : segmentGap,
                    lineWidth: lineWidth
                )
            }
            if let centerText {
                Text(centerText)
                    .font(Typography.label.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(lineWidth + Spacing.xs)
            }
        }
        .frame(width: diameter, height: diameter)
        .animation(reduceMotion ? nil : Motion.curve(Motion.figure), value: rings)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibleLabel)
    }

    private var accessibleLabel: String {
        rings.prefix(3)
            .map { "\($0.kind.label) \($0.done)/\($0.total)" }
            .joined(separator: ", ")
    }
}

private struct Sector: View {
    let ring: HavenRing
    let from: Double
    let to: Double
    let segmentGap: Double?
    let lineWidth: CGFloat

    var body: some View {
        let total = max(ring.total, 0)
        let done = min(max(ring.done, 0), total)
        let step = total > 0 ? (to - from) / Double(total) : 0
        let color = ring.kind.color
        let style = StrokeStyle(lineWidth: lineWidth, lineCap: .butt)
        ZStack {
            if let segmentGap, total > 1, step >= segmentGap * 2.5 {
                ForEach(0..<total, id: \.self) { k in
                    Circle()
                        .trim(
                            from: from + Double(k) * step + segmentGap / 2,
                            to: from + Double(k + 1) * step - segmentGap / 2
                        )
                        .stroke(color.opacity(k < done ? 1 : Theme.ringTrackOpacity), style: style)
                }
            } else {
                Circle().trim(from: from, to: to)
                    .stroke(color.opacity(Theme.ringTrackOpacity), style: style)
                if done > 0 {
                    Circle().trim(from: from, to: from + step * Double(done))
                        .stroke(color, style: style)
                }
            }
        }
        .padding(lineWidth / 2)
        .rotationEffect(.degrees(-90))
    }
}

#Preview("Mission disc") {
    HStack(spacing: Spacing.l) {
        HavenRings(
            rings: [
                HavenRing(kind: .routine, done: 4, total: 7),
                HavenRing(kind: .measurements, done: 6, total: 7),
                HavenRing(kind: .wellbeing, done: 1, total: 1),
            ],
            diameter: 80,
            centerText: "11/15"
        )
        HavenRings(rings: [HavenRing(kind: .routine, done: 2, total: 7)], diameter: 64)
    }
    .padding()
    .background(Theme.background)
}
