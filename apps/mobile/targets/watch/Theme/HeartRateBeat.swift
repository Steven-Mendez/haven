import SwiftUI

// Heart rate with its age (W01, W04). The number is the hero (metric-xl 56 or metric 40, tabular) with a small grey
// «lpm» on the baseline. The heart is grey, never red (red is reserved for emergencies), and the figure has no level
// colour: the watch does not assess, the phone's engine does.
// Subtle motion (SPEC §5): only while `live` (workout session delivering samples) the heart pulses softly next to
// «En vivo»; figures change with a fade + rise. With Reduce Motion nothing pulses and figures only cross-fade.

struct HeartRateBeat: View {
    enum Size { case large, medium }

    let heartRate: Double?
    let takenAt: Date?
    var size: Size = .large
    /// Shows «En vivo» (workout session running, W04) instead of the age only.
    var live: Bool = false
    /// «118 lpm  ♥ En vivo» on one baseline (saves a line on the monitor's first screen). Wrap it in a
    /// `ViewThatFits` with a stacked fallback: it does not shrink to fit.
    var inline: Bool = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if inline {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.m) {
                    figure
                        .fixedSize()
                    Spacer(minLength: 0)
                    liveLine
                        .fixedSize()
                }
            } else {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    figure
                    liveLine
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibleLabel)
    }

    private var figure: some View {
        MetricText(
            value: heartRate,
            unit: L("lpm", "bpm"),
            font: size == .large ? Typography.metricXL : Typography.metric
        )
    }

    private var liveLine: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
            Image(systemName: "heart.fill")
                .font(Typography.caption)
                .foregroundStyle(live ? Theme.foreground : Theme.tertiary)
                .symbolEffect(.pulse, options: .repeating, isActive: live && !reduceMotion)
            if live {
                Text(L("En vivo", "Live"))
                    .font(Typography.caption)
                    .foregroundStyle(Theme.mutedForeground)
            } else {
                AgeLabel(since: takenAt, staleAfterMin: 30)
            }
        }
    }

    private var accessibleLabel: String {
        guard let heartRate else { return L("Frecuencia cardíaca: sin dato", "Heart rate: no data") }
        let value = Int(heartRate.rounded())
        let when = live ? ", \(L("en vivo", "live"))" : takenAt.map { ", \(Strings.ago($0))" } ?? ""
        return L("Frecuencia cardíaca \(value) latidos por minuto", "Heart rate \(value) beats per minute") + when
    }
}

#Preview("Heart rate") {
    VStack(alignment: .leading, spacing: Spacing.l) {
        HeartRateBeat(heartRate: 72, takenAt: .now.addingTimeInterval(-240))
        HeartRateBeat(heartRate: 118, takenAt: .now, size: .medium, live: true)
        HeartRateBeat(heartRate: nil, takenAt: nil)
    }
    .background(Theme.background)
}
