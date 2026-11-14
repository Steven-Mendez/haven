import SwiftUI

// W03 (Deneb) · Emergency button, the watch app's only screen (SPEC.md §5, §6 «Emergencia»).
//   Idle → press and hold the SOS ring for 3 s (linear red fill, one haptic click per second, the seconds left in the
//   centre) → `EmergencyCenter.send(.button)` → `bridge.startEmergency` (sends `emergency { origin: 'button' }` and
//   ContentView opens the monitor, W04, full screen).
//   Lifting the finger before 3 s cancels: nothing is sent and «Cancelado · sin enviar» shows for a moment.
//   While holding, the line under the ring says «Suelta para cancelar».
//   Below the fold: offline notice, last alert and the automatic triggers, each with its toggle.
// One step per screen: hold → (sent) → monitor. Red is only the SOS disc, its ring and level shapes.

struct EmergencyView: View {
    @Environment(WatchBridge.self) private var bridge
    @State private var center = EmergencyCenter.shared
    @State private var phase: Phase = .idle
    @State private var holdStartedAt: Date?

    enum Phase: Equatable {
        case idle, holding, cancelled
    }

    /// Seconds the SOS ring must be held (SPEC §5).
    static let holdSeconds = 3
    /// A release earlier than this is a stray touch, not a cancel: no notice.
    static let minimumHeldForNotice: TimeInterval = 0.5
    /// How long «Cancelado» stays before going back to idle.
    static let cancelledNoticeSeconds = 3

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    firstScreen(width: proxy.size.width)
                        .aboveTheFold(minHeight: proxy.size.height, alignment: .center)
                    belowTheFold
                }
                .havenScreen()
            }
        }
        // Language.current is not observable: rebuild the texts when the phone's language changes (as Altair does).
        .id(bridge.status?.payload.language ?? Language.current.rawValue)
        .background(Theme.background)
        .onChange(of: bridge.isEmergencyActive) { _, isActive in
            if isActive { phase = .idle }
        }
    }

    // MARK: First screen

    @ViewBuilder private func firstScreen(width: CGFloat) -> some View {
        VStack(spacing: Spacing.m) {
            if bridge.isEmergencyActive, let alert = center.lastAlert {
                SentAlertSummary(alert: alert)
            } else {
                HoldToConfirm(
                    duration: Self.holdSeconds,
                    onPressingChanged: { pressing in
                        if pressing {
                            holdStartedAt = .now
                            phase = .holding
                        } else {
                            // A brief touch (scrolling past the ring) is not worth a «Cancelado».
                            let held = holdStartedAt.map { Date.now.timeIntervalSince($0) } ?? 0
                            phase = held >= Self.minimumHeldForNotice ? .cancelled : .idle
                            holdStartedAt = nil
                        }
                    },
                    onConfirm: {
                        phase = .idle
                        center.send(.button)
                    }
                )
                // ≈ 62 % of the width: a big target, with room for the hint line above the fold.
                .frame(width: min(width * 0.62, 132))
                .accessibilityHint(EmergencyTexts.accessibilityHint)
                hint
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// One line under the ring: how to send, how to cancel, or that it was cancelled.
    @ViewBuilder private var hint: some View {
        switch phase {
        case .idle:
            Text(EmergencyTexts.holdHint)
                .font(Typography.label)
                .foregroundStyle(Theme.mutedForeground)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        case .holding:
            Text(EmergencyTexts.releaseToCancel)
                .font(Typography.label.weight(.medium))
                .foregroundStyle(Theme.foreground)
                .multilineTextAlignment(.center)
        case .cancelled:
            LevelBadge(text: EmergencyTexts.cancelled)
                .task {
                    try? await Task.sleep(for: .seconds(Self.cancelledNoticeSeconds))
                    if phase == .cancelled { phase = .idle }
                }
        }
    }

    // MARK: Below the fold

    private var belowTheFold: some View {
        VStack(alignment: .leading, spacing: Spacing.l) {
            if !bridge.isReachable {
                OfflineNotice(since: bridge.status?.evaluatedAt)
            }
            if !bridge.isEmergencyActive, let alert = center.lastAlert {
                AgeLabel(since: alert.at, prefix: L("Último aviso", "Last alert"))
            }
            AutoTriggerSettings()
                // Clear of the TabView page dots on the right edge.
                .padding(.trailing, Spacing.s)
        }
    }
}

/// Visible texts of the SOS page (es/en).
enum EmergencyTexts {
    static var holdHint: String { L("Mantén 3 s para avisar", "Hold 3 s to alert") }
    static var releaseToCancel: String { L("Suelta para cancelar", "Release to cancel") }
    static var cancelled: String { L("Cancelado · sin enviar", "Cancelled · not sent") }
    static var accessibilityHint: String {
        L(
            "Mantén pulsado 3 segundos: avisa a tu tripulación y abre el protocolo en el iPhone",
            "Hold for 3 seconds: alerts your crew and opens the protocol on the iPhone"
        )
    }
}

// MARK: - Sent / queued summary (also used by the monitor)

/// «◆ Aviso enviado · 12:03 · Sigue el protocolo en el iPhone», or the queued version without iPhone
/// («Aviso en cola · se enviará al reconectar. Pide ayuda en voz alta.»). Never says «enviado» without iPhone.
struct SentAlertSummary: View {
    let alert: EmergencyCenter.SentAlert
    var compact = false

    @Environment(WatchBridge.self) private var bridge

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            if alert.queued && !bridge.isReachable {
                LevelBadge(level: .red, text: L("Aviso en cola", "Alert queued"))
                Text(
                    L(
                        "Se enviará al reconectar. Pide ayuda en voz alta.",
                        "It will be sent on reconnect. Call for help out loud."
                    )
                )
                .font(Typography.body)
                .foregroundStyle(Theme.foreground)
                .fixedSize(horizontal: false, vertical: true)
            } else {
                LevelBadge(level: .red, text: L("Aviso enviado", "Alert sent"))
                if !compact {
                    Text(L("Sigue el protocolo en el iPhone", "Follow the protocol on the iPhone"))
                        .font(Typography.title)
                        .foregroundStyle(Theme.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Text(detail)
                .font(Typography.caption)
                .foregroundStyle(Theme.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        let time = alert.at.formatted(
            Date.FormatStyle(date: .omitted, time: .shortened).locale(Language.current.locale))
        let origin = alert.origin == .button ? L("Botón SOS", "SOS button") : alert.origin.triggerName
        if alert.queued && bridge.isReachable {
            return "\(origin) · \(time) · " + L("conexión recuperada", "reconnected")
        }
        return "\(origin) · \(time)"
    }
}

// MARK: - Automatic trigger settings

private struct AutoTriggerSettings: View {
    @State private var center = EmergencyCenter.shared

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            SectionLabel(L("Avisos automáticos", "Automatic alerts"))
            Text(
                L(
                    "Cuenta atrás de \(AutoTriggerThresholds.countdownSeconds) s con «Estoy bien» antes de avisar",
                    "\(AutoTriggerThresholds.countdownSeconds) s countdown with «I'm OK» before alerting"
                )
            )
            .font(Typography.caption)
            .foregroundStyle(Theme.mutedForeground)
            .fixedSize(horizontal: false, vertical: true)
            ForEach(EmergencyPayload.Origin.automatic, id: \.self) { origin in
                Hairline()
                if origin.isAvailable {
                    Toggle(isOn: binding(origin)) {
                        triggerLabel(origin)
                    }
                    .tint(Theme.accent)
                    .frame(minHeight: Theme.tapTarget)
                } else {
                    // No source (fall detection needs an entitlement): a plain row, not a switch that cannot move.
                    triggerLabel(origin)
                        .frame(maxWidth: .infinity, minHeight: Theme.tapTarget, alignment: .leading)
                        .accessibilityElement(children: .combine)
                }
            }
            Hairline()
        }
    }

    private func triggerLabel(_ origin: EmergencyPayload.Origin) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(origin.triggerName)
                .font(Typography.label)
                .foregroundStyle(Theme.foreground)
            Text(origin.triggerDetail)
                .font(Typography.caption)
                .foregroundStyle(Theme.mutedForeground)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func binding(_ origin: EmergencyPayload.Origin) -> Binding<Bool> {
        Binding(
            get: { origin.isAvailable && center.enabledTriggers.contains(origin) },
            set: { center.setEnabled(origin, $0) }
        )
    }
}

#Preview {
    EmergencyView()
        .environment(WatchBridge(activate: false))
}
