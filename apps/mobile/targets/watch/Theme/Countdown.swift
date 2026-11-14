import SwiftUI
import WatchKit

// Circular countdown for the automatic triggers (W03, «Caída detectada», 15 s with «Estoy bien»): a red ring of
// `Theme.ringWidth` on a `Theme.muted` track that empties linearly, the seconds in the centre (metric 40, tabular)
// and one haptic click per second, so it can be felt without looking. With Reduce Motion the ring steps once per
// second instead of sweeping. At zero it calls `onFinish` exactly once. Cancel = remove the view: its task is
// cancelled and `onFinish` is never called.

struct Countdown: View {
    var seconds: Int = 5
    var color: Color = Theme.red
    var haptics: Bool = true
    let onFinish: () -> Void

    @State private var remaining: Int?
    @State private var fraction: Double = 1

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let total = max(seconds, 1)
        let left = remaining ?? total
        ZStack {
            Circle().stroke(Theme.muted, lineWidth: Theme.ringWidth)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(color, style: StrokeStyle(lineWidth: Theme.ringWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(left)")
                    .font(Typography.metric)
                    .foregroundStyle(Theme.foreground)
                    .contentTransition(reduceMotion ? .opacity : .numericText(countsDown: true))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text("s")
                    .font(Typography.caption)
                    .foregroundStyle(Theme.tertiary)
            }
            .padding(Theme.ringWidth + Spacing.s)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L("Enviando en \(left) s", "Sending in \(left) s"))
        .task { await run(total: total) }
    }

    private func run(total: Int) async {
        for second in stride(from: total, to: 0, by: -1) {
            withAnimation(reduceMotion ? nil : Motion.curve(Motion.standard)) { remaining = second }
            let next = Double(second - 1) / Double(total)
            if reduceMotion {
                fraction = Double(second) / Double(total)
            } else {
                withAnimation(.linear(duration: 1)) { fraction = next }
            }
            if haptics { WKInterfaceDevice.current().play(.click) }
            do { try await Task.sleep(for: .seconds(1)) } catch { return }
        }
        guard !Task.isCancelled else { return }
        remaining = 0
        fraction = 0
        onFinish()
    }
}

#Preview("Countdown") {
    VStack(spacing: Spacing.m) {
        Countdown(seconds: 5) {}
            .frame(width: 110, height: 110)
        Button(Strings.cancel) {}.buttonStyle(.haven(.outline))
    }
    .background(Theme.background)
}
