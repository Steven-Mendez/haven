import SwiftUI
import WatchKit

// Hold-to-confirm SOS (W03; SPEC.md §5 «El SOS se activa manteniendo pulsado 3 s»). A red disc with «SOS» inside a
// ring. Pressing starts a linear fill of the ring and one haptic click per second, and the centre counts the seconds
// left; at `duration` it plays `.success` and calls `onConfirm` once. Lifting the finger (or sliding off) before that
// cancels: the ring empties and nothing is sent. With Reduce Motion the ring steps once per second.
// VoiceOver: one button «SOS»; its default action confirms (focus + double tap is already deliberate), and «double
// tap and hold» also works.

struct HoldToConfirm: View {
    var duration: Int = 3
    var title: String = "SOS"
    var haptics: Bool = true
    /// The press started (true) or ended without confirming (false), e.g. to show «Suelta para cancelar».
    var onPressingChanged: ((Bool) -> Void)?
    let onConfirm: () -> Void

    @State private var progress: Double = 0
    @State private var remaining: Int?
    @State private var ticks: Task<Void, Never>?
    @State private var pressStartedAt: Date?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle().stroke(Theme.muted, lineWidth: Theme.holdRingWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(Theme.red, style: StrokeStyle(lineWidth: Theme.holdRingWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Circle()
                .fill(Theme.destructive)
                .padding(Theme.holdRingWidth + Spacing.s)
                .opacity(remaining == nil ? 1 : 0.85)
            Group {
                if let remaining {
                    Text("\(remaining)")
                        .font(Typography.metric)
                        .contentTransition(reduceMotion ? .opacity : .numericText(countsDown: true))
                } else {
                    Text(title)
                        .font(Typography.display)
                }
            }
            .foregroundStyle(Theme.destructiveForeground)
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .padding(Theme.holdRingWidth + Spacing.l)
        }
        .aspectRatio(1, contentMode: .fit)
        .contentShape(Circle())
        .onLongPressGesture(
            minimumDuration: Double(duration),
            maximumDistance: 24,
            perform: confirm,
            onPressingChanged: { pressing in
                if pressing { begin() } else { cancel() }
            }
        )
        .onDisappear {
            pressStartedAt = nil
            cancel()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { onConfirm() }
    }

    private func begin() {
        ticks?.cancel()
        remaining = duration
        pressStartedAt = .now
        onPressingChanged?(true)
        if reduceMotion {
            progress = 0
        } else {
            withAnimation(.linear(duration: Double(duration))) { progress = 1 }
        }
        ticks = Task { @MainActor in
            for second in 0..<duration {
                guard !Task.isCancelled else { return }
                remaining = duration - second
                if reduceMotion { progress = Double(second) / Double(duration) }
                if haptics { WKInterfaceDevice.current().play(.click) }
                do { try await Task.sleep(for: .seconds(1)) } catch { return }
            }
        }
    }

    private func confirm() {
        ticks?.cancel()
        ticks = nil
        if haptics { WKInterfaceDevice.current().play(.success) }
        progress = 1
        onConfirm()
        reset(animated: false)
    }

    /// The finger lifted before `duration`, or the view went away. SwiftUI may report «not pressing» just before
    /// `perform` on a completed hold: that case is left to `confirm`, so it never reads as a cancel.
    private func cancel() {
        guard remaining != nil else { return }
        if let pressStartedAt, Date.now.timeIntervalSince(pressStartedAt) >= Double(duration) - 0.1 { return }
        ticks?.cancel()
        ticks = nil
        onPressingChanged?(false)
        reset(animated: true)
    }

    private func reset(animated: Bool) {
        remaining = nil
        pressStartedAt = nil
        withAnimation(animated && !reduceMotion ? Motion.curve(Motion.enter) : nil) { progress = 0 }
    }
}

#Preview("Hold to confirm") {
    HoldToConfirm {}
        .frame(width: 120)
        .background(Theme.background)
}
