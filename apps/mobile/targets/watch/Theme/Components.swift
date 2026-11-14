import SwiftUI

extension View {
    func card(border: Color = Theme.border) -> some View {
        padding(Spacing.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).strokeBorder(Theme.border, lineWidth: 1))
    }
}

struct Hairline: View {
    var body: some View {
        Rectangle()
            .fill(Theme.border)
            .frame(height: 1)
            .accessibilityHidden(true)
    }
}

struct SectionLabel: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(Typography.micro)
            .textCase(.uppercase)
            .tracking(0.6)
            .foregroundStyle(Theme.tertiary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .accessibilityAddTraits(.isHeader)
    }
}

struct MetricText: View {
    let value: Double?
    var unit: String?
    var font: Font = Typography.metric

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
            Text(value.map { "\(Int($0.rounded()))" } ?? "—")
                .font(font)
                .foregroundStyle(value == nil ? Theme.tertiary : Theme.foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(reduceMotion ? .opacity : .numericText(value: value ?? 0))
                .animation(Motion.curve(Motion.figure), value: value)
            if let unit {
                Text(unit)
                    .font(Typography.bodySmall)
                    .foregroundStyle(Theme.mutedForeground)
                    .lineLimit(1)
            }
        }
    }
}

extension View {
    func havenScreen() -> some View {
        padding(.horizontal, Theme.screenMargin)
            .padding(.bottom, Theme.cornerInset)
    }

    func aboveTheFold(alignment: Alignment = .topLeading) -> some View {
        ZStack(alignment: alignment) {
            Color.clear
                .containerRelativeFrame(.vertical)
                .accessibilityHidden(true)
            padding(.bottom, Theme.cornerInset)
        }
        .frame(maxWidth: .infinity, alignment: alignment)
        .padding(.bottom, Theme.foldGap)
    }

    func clockBand() -> some View {
        modifier(ClockBand())
    }

    func aboveTheFold(minHeight: CGFloat, alignment: Alignment = .topLeading) -> some View {
        padding(.bottom, Theme.cornerInset)
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: alignment)
            .padding(.bottom, Theme.foldGap)
    }
}

private struct ClockBand: ViewModifier {
    func body(content: Content) -> some View {
        GeometryReader { proxy in
            content
                .overlay(alignment: .top) {
                    LinearGradient(
                        stops: [
                            .init(color: Theme.background, location: 0),
                            .init(color: Theme.background, location: 0.8),
                            .init(color: Theme.background.opacity(0), location: 1),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: proxy.safeAreaInsets.top)
                    .offset(y: -proxy.safeAreaInsets.top)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
        }
    }
}

struct AgeLabel: View {
    let since: Date?
    var prefix: String?
    var staleAfterMin: Double?

    var body: some View {
        TimelineView(.everyMinute) { context in
            let stale = isStale(now: context.date)
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
                if stale {
                    Image(systemName: "clock")
                        .imageScale(.small)
                }
                Text(text(now: context.date))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .font(Typography.caption)
            .foregroundStyle(stale ? Theme.foreground : Theme.mutedForeground)
            .accessibilityElement(children: .combine)
        }
    }

    private func isStale(now: Date) -> Bool {
        guard let staleAfterMin else { return false }
        guard let since else { return true }
        return now.timeIntervalSince(since) > staleAfterMin * 60
    }

    private func text(now: Date) -> String {
        guard let since else { return prefix.map { "\($0): \(Strings.noData)" } ?? Strings.noData }
        let ago = Strings.ago(since, now: now)
        return prefix.map { "\($0) \(ago)" } ?? ago
    }
}

struct OfflineNotice: View {
    let since: Date?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.m) {
            Image(systemName: "iphone.slash")
                .font(Typography.label)
                .foregroundStyle(Theme.mutedForeground)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(Strings.noIPhone)
                    .font(Typography.caption.weight(.medium))
                    .foregroundStyle(Theme.foreground)
                    .fixedSize(horizontal: false, vertical: true)
                AgeLabel(since: since, prefix: L("Último estado", "Last status"))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(RoundedRectangle(cornerRadius: Theme.radius).strokeBorder(Theme.border, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

struct PendingScreen: View {
    let id: String
    let title: String

    var body: some View {
        VStack(spacing: Spacing.m) {
            LevelBadge(text: id)
            Text(title).font(Typography.title).foregroundStyle(Theme.foreground)
            Text(L("Pendiente", "Pending")).font(Typography.label).foregroundStyle(Theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}

#Preview("Components") {
    ScrollView {
        VStack(spacing: Spacing.m) {
            OfflineNotice(since: .now.addingTimeInterval(-12 * 60))
            VStack(alignment: .leading, spacing: Spacing.s) {
                LevelBadge(level: .amber)
                Text("Glucosa").font(Typography.title)
                AgeLabel(since: .now.addingTimeInterval(-300))
            }
            .card()
            MetricText(value: 72, unit: "lpm")
        }
    }
    .background(Theme.background)
}
