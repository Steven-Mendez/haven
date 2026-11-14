import SwiftUI

// Small shared pieces: Card, age label, offline notice and placeholder screen.
// The neutral Badge is `LevelBadge(text:)` (Level.swift).

// MARK: - Card

extension View {
    /// Hairline group (SPEC §1.1): no fill, a 1 pt `Theme.border` outline and radius 12. The outline is never tinted
    /// with a level: the level is told by a LevelBadge inside. `border` is kept for source compatibility and ignored.
    func card(border: Color = Theme.border) -> some View {
        padding(Spacing.l)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(RoundedRectangle(cornerRadius: Theme.radius).strokeBorder(Theme.border, lineWidth: 1))
    }
}

// MARK: - Hairline and section label

/// 1 pt horizontal hairline (`Theme.border`) between rows.
struct Hairline: View {
    var body: some View {
        Rectangle()
            .fill(Theme.border)
            .frame(height: 1)
            .accessibilityHidden(true)
    }
}

/// Caps section label (SPEC §3: 11-ish caps with +0.6 tracking, tertiary). Watch section headers only. Tertiary is
/// #80808A since SPEC v3.1 (≈ 5.4:1 on black, AA at small sizes; #6B6B73 was ≈ 4:1).
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

// MARK: - Figure with unit

/// Hero number (SPEC §1.3): tabular figure, small grey unit on the baseline. Changes fade and rise (`.numericText`);
/// with Reduce Motion it only cross-fades. `value == nil` shows «—» in grey.
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

// MARK: - Screen layout (rounded display corners)

extension View {
    /// Root layout of a page (DISENO.md §2.1): horizontal `Theme.screenMargin` and `Theme.cornerInset` free at the
    /// bottom, so the last element (usually a full-width button) never sits in the rounded corners. Apply it to the
    /// VStack inside the ScrollView, or to the root VStack of a non-scrolling page (countdown, confirmations).
    func havenScreen() -> some View {
        padding(.horizontal, Theme.screenMargin)
            .padding(.bottom, Theme.cornerInset)
    }

    /// First view of a scrolling page: at least the visible height (content below only appears when turning the
    /// crown) with `Theme.cornerInset` free at the bottom, so neither its last element nor the next section peek into
    /// the rounded corners. It is a *minimum* height: when the first view does not fit (e.g. Status in red and
    /// offline) it grows and scrolls instead of clipping. The invisible spacer takes the scroll view's visible height
    /// (`containerRelativeFrame`), so no GeometryReader is needed. `Theme.foldGap` below the block compensates the
    /// height that measure misses on watchOS, so nothing of the next section shows until the crown turns.
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

    /// Full-screen covers that hide the navigation bar (no system ✕: monitor) also lose the system fade under the
    /// clock, so scrolled content ran under the time. Apply to the ScrollView: it paints the top safe area black
    /// (`Theme.background`) so the clock row stays clear. Not for content: it only covers what scrolled away.
    func clockBand() -> some View {
        modifier(ClockBand())
    }

    /// Same as `aboveTheFold(alignment:)` with an explicit minimum height, for pages that already read the visible
    /// height with a GeometryReader around the ScrollView: `.aboveTheFold(minHeight: proxy.size.height)`.
    func aboveTheFold(minHeight: CGFloat, alignment: Alignment = .topLeading) -> some View {
        padding(.bottom, Theme.cornerInset)
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: alignment)
            .padding(.bottom, Theme.foldGap)
    }
}

/// See `clockBand()`. The outer GeometryReader respects the safe area, so its top inset is the clock row.
private struct ClockBand: ViewModifier {
    func body(content: Content) -> some View {
        GeometryReader { proxy in
            content
                .overlay(alignment: .top) {
                    // Solid behind the clock, fading out over its last points so scrolled text does not end in a
                    // hard cut. The content never rests above the safe area, so nothing is dimmed at rest.
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

// MARK: - Age label

/// «hace 5 min» (§3.11): one grey caption line under every value; wraps instead of truncating.
/// Refreshes itself every minute. With `prefix` it reads «Último estado hace 5 min».
/// Past `staleAfterMin` (or with no date) it gets a `clock` icon and primary text, never an alert color.
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

// MARK: - Offline notice

/// Neutral hairline row shown at the top when the iPhone is not reachable (not amber: it is not a health alert).
/// `since` is the `evaluatedAt` of the last `status` message.
/// Text wraps to as many lines as it needs: on every case size (41–49 mm) nothing is truncated.
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

// MARK: - Placeholder for unbuilt screens (same as mobile PendingScreen)

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
