import SwiftUI
import WidgetKit

struct StatusEntry: TimelineEntry {
    let date: Date
    let snapshot: ComplicationSnapshot?
}

struct StatusProvider: TimelineProvider {
    private static let step: TimeInterval = 10 * 60
    private static let horizon: TimeInterval = 3 * 60 * 60

    func placeholder(in context: Context) -> StatusEntry {
        StatusEntry(date: .now, snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (StatusEntry) -> Void) {
        completion(StatusEntry(date: .now, snapshot: ComplicationSnapshot.load() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StatusEntry>) -> Void) {
        let snapshot = ComplicationSnapshot.load()
        let now = Date.now
        let entries = stride(from: 0, through: Self.horizon, by: Self.step).map {
            StatusEntry(date: now.addingTimeInterval($0), snapshot: snapshot)
        }
        completion(Timeline(entries: entries, policy: .never))
    }
}

struct StatusComplicationView: View {
    let entry: StatusEntry
    @Environment(\.widgetFamily) private var family

    private var level: ComplicationLevel { entry.snapshot?.level ?? .pending }
    private var language: WidgetLanguage { entry.snapshot?.widgetLanguage ?? .system }
    private var label: String { level.label(language) }
    private var isStale: Bool { entry.snapshot?.isStale(at: entry.date) ?? true }

    var body: some View {
        content
            .environment(\.locale, language.locale)
            .containerBackground(for: .widget) { Color.clear }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("HAVEN. \(label). \(nextText)")
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryCorner: corner
        case .accessoryInline: inline
        default: rectangular
        }
    }

    private var symbol: some View {
        Image(systemName: level.symbol)
            .foregroundStyle(level.color)
            .widgetAccentable()
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                symbol.font(.system(size: 20, weight: .semibold))
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, 4)
            }
        }
    }

    private var corner: some View {
        symbol
            .font(.system(size: 22, weight: .semibold))
            .widgetLabel {
                Text(label.count > 8 ? label : "HAVEN · \(label)")
            }
    }

    private var inline: some View {
        ViewThatFits {
            Text("\(level.glyph) \(label) · \(nextText)")
            Text("\(level.glyph) \(label)")
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 4) {
                Text("HAVEN")
                    .font(.system(size: 12, weight: .semibold))
                    .tracking(0.6)
                    .foregroundStyle(WidgetTheme.mutedForeground)
                Spacer(minLength: 0)
                if isStale {
                    Image(systemName: "clock")
                        .font(.system(size: 11))
                        .foregroundStyle(WidgetTheme.foreground)
                }
            }
            HStack(spacing: 4) {
                symbol.font(.system(size: 11, weight: .semibold))
                Text(label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(level.color)
                    .lineLimit(1)
                Spacer(minLength: 4)
                WidgetLevelMeter(level: level)
                    .frame(width: 36)
            }
            Text(nextText)
                .font(.system(size: 13))
                .foregroundStyle(WidgetTheme.foreground)
                .lineLimit(1)
            Text(ageText)
                .font(.system(size: 12).monospacedDigit())
                .foregroundStyle(WidgetTheme.mutedForeground)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var nextText: String {
        guard let snapshot = entry.snapshot else {
            return language.pick("Abre HAVEN en el iPhone", "Open HAVEN on iPhone")
        }
        return snapshot.nextPending ?? language.pick("Nada pendiente hoy", "Nothing pending today")
    }

    private var ageText: String {
        guard let snapshot = entry.snapshot else { return language.pick("sin dato", "no data") }
        let minutes = Int(max(0, entry.date.timeIntervalSince(snapshot.evaluatedAt)) / 60)
        let ago: String
        if minutes < 1 {
            ago = language.pick("ahora", "now")
        } else if minutes < 60 {
            ago = language.pick("hace \(minutes) min", "\(minutes) min ago")
        } else {
            ago = language.pick("hace \(minutes / 60) h", "\(minutes / 60) h ago")
        }
        return ago
    }
}

@main
struct HavenStatusComplication: Widget {
    let kind = "app.haven.watch.status"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatusProvider()) { entry in
            StatusComplicationView(entry: entry)
        }
        .configurationDisplayName("HAVEN")
        .description(WidgetLanguage.system.pick("Tu estado general", "Your overall status"))
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

#Preview(as: .accessoryRectangular) {
    HavenStatusComplication()
} timeline: {
    StatusEntry(
        date: .now,
        snapshot: ComplicationSnapshot(
            overallLevel: "amber", nextPending: "Glucosa", evaluatedAt: .now.addingTimeInterval(-720),
            language: "es"))
}
