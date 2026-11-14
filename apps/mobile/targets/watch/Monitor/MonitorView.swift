import SwiftUI

// W04 (Deneb) · Patient monitor (targets/watch/DISENO.md §4, W04). Full screen while `bridge.isEmergencyActive`
// (ContentView). Heart rate from HealthKit («En vivo» while the workout session delivers it, otherwise the sample's
// age; Monitor/PatientMonitor.swift), latest SpO₂ with its age (stale after 30 min), sending
// status, crew messages without haptics, «Terminar» with inline confirmation → `bridge.endEmergency()`.
// Live Activity grammar (SPEC §6, Citizen / Apple Fitness): one header line «▲ Emergencia · 04:12» (elapsed, mono),
// the heart rate as the 56 pt hero, one SpO₂ line and a single neutral pill. The heart rate has no level colour: the
// watch does not assess. Only the «Live» heart pulses (off with Reduce Motion).

struct MonitorView: View {
    @Environment(WatchBridge.self) private var bridge
    @State private var monitor = PatientMonitor()
    @State private var center = EmergencyCenter.shared
    @State private var confirmingEnd = false

    /// SpO₂ is never live: past this age it is shown as stale (`clock`, primary text).
    static let spo2StaleAfterMin: Double = 30

    var body: some View {
        ScrollViewReader { proxy in
            content
                // The inline confirmation grows below the fold: bring it into view from its question down (anchored
                // at the bottom, the question went under the clock band on the Ultra 49 mm).
                .onChange(of: confirmingEnd) { _, isConfirming in
                    if isConfirming {
                        withAnimation(Motion.curve(Motion.enter)) {
                            proxy.scrollTo(Self.endControlsID, anchor: .top)
                        }
                    }
                }
        }
    }

    private static let endControlsID = "endControls"

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.m) {
                // First view: header, heart rate, one SpO₂ line, end. If the alert did not go out (no iPhone), that
                // comes first (Castor, QA): the wearer must know to call for help out loud.
                header
                if isAlertQueued {
                    queuedAlertNotice
                }
                // «♥ En vivo» on the figure's baseline, so «Terminar» stays above the fold (QA in the Ultra 49 mm
                // simulator: stacked, the pill fell into the bottom corners). Three-digit rates step down to 40.
                ViewThatFits(in: .horizontal) {
                    heartRate(size: isAlertQueued ? .medium : .large, inline: true)
                    heartRate(size: .medium, inline: true)
                    heartRate(size: .medium, inline: false)
                }
                if monitor.sessionUnavailable && monitor.heartRate == nil {
                    Text(
                        L("Sin pulso en vivo: revisa el permiso de Salud", "No live pulse: check the Health permission")
                    )
                    .font(Typography.caption)
                    .foregroundStyle(Theme.foreground)
                    .fixedSize(horizontal: false, vertical: true)
                }
                spo2Line
                Hairline()
                endControls
                    .id(Self.endControlsID)
                // Below the fold: alert status, connection, sending, crew messages.
                if let alert = center.lastAlert, isCurrent(alert) {
                    SentAlertSummary(alert: alert, compact: true)
                        // Fold gap: with a three-digit rate (40 pt row) the badge peeked into the bottom corners.
                        .padding(.top, Theme.foldGap)
                }
                if !bridge.isReachable {
                    OfflineNotice(since: bridge.status?.evaluatedAt)
                }
                Text(sendingText)
                    .font(Typography.caption)
                    .foregroundStyle(Theme.mutedForeground)
                    .fixedSize(horizontal: false, vertical: true)
                if let crew = crewMessage {
                    VStack(alignment: .leading, spacing: Spacing.s) {
                        SectionLabel(L("Tripulación", "Crew"))
                        Text(crew.message)
                            .font(Typography.label)
                            .foregroundStyle(Theme.foreground)
                            .fixedSize(horizontal: false, vertical: true)
                        AgeLabel(since: crew.receivedAt)
                    }
                    .card()
                }
            }
            .havenScreen()
        }
        // Language.current is not observable: rebuild the texts when the phone's language changes. On the scroll
        // view, so the PatientMonitor state (@State here) survives it.
        .id(bridge.status?.payload.language ?? Language.current.rawValue)
        // Without the navigation bar there is no system fade under the clock: keep the clock row clear.
        .clockBand()
        .background(Theme.background)
        // No system ✕: ending the emergency always goes through «Terminar» and its confirmation.
        .toolbar(.hidden, for: .navigationBar)
        .task { monitor.start(bridge: bridge) }
        .onDisappear { monitor.stop() }
        .onChange(of: bridge.isEmergencyActive) { _, isActive in
            if !isActive { monitor.stop() }
        }
    }

    private func heartRate(size: HeartRateBeat.Size, inline: Bool) -> some View {
        HeartRateBeat(
            heartRate: monitor.heartRate,
            takenAt: monitor.heartRateAt,
            size: size,
            live: monitor.isLive,
            inline: inline
        )
    }

    // MARK: Header

    /// «▲ Emergencia · 04:12»: the level shape and word in red, and the time since the emergency started (mono,
    /// self-updating like a Live Activity timer). Kept on the left, away from the system clock.
    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
            Image(systemName: Level.red.symbol)
                .font(.system(size: 9, weight: .semibold))
            Text(Level.red.label)
                .font(Typography.label.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            if let startedAt = bridge.emergencyStartedAt {
                Text("·")
                    .font(Typography.label)
                    .foregroundStyle(Theme.tertiary)
                Text(startedAt, style: .timer)
                    .font(Typography.mono)
                    .foregroundStyle(Theme.mutedForeground)
                    .fixedSize()
            }
        }
        .foregroundStyle(Theme.red)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: SpO₂

    /// «SpO₂ 96 % ◷ hace 42 min» in one line (DESIGN_SYSTEM.md §8.0.5, §8.14). If it does not fit (long English
    /// text on a small watch), the age goes under the value. Never «live»: latest HealthKit sample.
    private var spo2Line: some View {
        let value = Text("SpO₂ " + (monitor.spo2.map { "\(Int($0.rounded())) %" } ?? "—"))
            .font(Typography.body.weight(.medium))
            .foregroundStyle(monitor.spo2 == nil ? Theme.mutedForeground : Theme.foreground)
            .fixedSize()
        let age = AgeLabel(since: monitor.spo2At, staleAfterMin: Self.spo2StaleAfterMin)
            .fixedSize()
        return ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
                value
                age
            }
            VStack(alignment: .leading, spacing: Spacing.xs) {
                value
                age
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spo2AccessibilityLabel)
    }

    private var spo2AccessibilityLabel: String {
        guard let spo2 = monitor.spo2 else { return L("Oxígeno en sangre: sin dato", "Blood oxygen: no data") }
        let age = monitor.spo2At.map { ", \(Strings.ago($0))" } ?? ""
        return L("Oxígeno en sangre \(Int(spo2.rounded())) %", "Blood oxygen \(Int(spo2.rounded()))%") + age
    }

    // MARK: End emergency

    @ViewBuilder
    private var endControls: some View {
        if confirmingEnd {
            VStack(alignment: .leading, spacing: Spacing.m) {
                Text(L("¿Terminar emergencia?", "End emergency?"))
                    .font(Typography.title)
                    .foregroundStyle(Theme.foreground)
                Button(L("Sí, terminar", "Yes, end it")) {
                    monitor.stop()
                    bridge.endEmergency()
                }
                .buttonStyle(.haven())
                Button(L("No, seguir", "No, keep going")) {
                    confirmingEnd = false
                }
                .buttonStyle(.haven(.secondary))
            }
            // Part of this block, so the buttons stay off the rounded corners when it is scrolled into view.
            .padding(.bottom, Theme.cornerInset)
        } else {
            Button(L("Terminar", "End")) {
                confirmingEnd = true
            }
            .buttonStyle(.haven(.secondary))
            .accessibilityLabel(L("Terminar emergencia", "End emergency"))
        }
    }

    // MARK: Queued alert (first view)

    /// The alert of this emergency was queued (no iPhone) and the iPhone is still unreachable.
    private var isAlertQueued: Bool {
        guard let alert = center.lastAlert, isCurrent(alert) else { return false }
        return alert.queued && !bridge.isReachable
    }

    /// One line, so «Terminar» still fits in the first view: «◆ Aviso en cola · pide ayuda». The full
    /// sentence (badge «◆ En cola · pide ayuda»; «Se enviará al reconectar. Pide ayuda en voz alta.») is below the fold (SentAlertSummary).
    private var queuedAlertNotice: some View {
        LevelBadge(level: .red, text: L("En cola · pide ayuda", "Queued · call for help"))
            .accessibilityLabel(
                L(
                    "Aviso en cola: se enviará al reconectar. Pide ayuda en voz alta.",
                    "Alert queued: it will be sent on reconnect. Call for help out loud."))
    }

    // MARK: Helpers

    private var sendingText: String {
        guard bridge.isReachable else {
            return L("Lecturas en cola hasta reconectar", "Readings queued until reconnect")
        }
        guard monitor.lastSentAt != nil else { return L("Preparando envío al iPhone", "Preparing to send") }
        let seconds = Int(PatientMonitor.sendInterval.components.seconds)
        return L("Enviando al iPhone cada \(seconds) s", "Sending to the iPhone every \(seconds) s")
    }

    /// The alert belongs to this emergency (the self-test may start one without going through EmergencyCenter).
    private func isCurrent(_ alert: EmergencyCenter.SentAlert) -> Bool {
        guard let startedAt = bridge.emergencyStartedAt else { return false }
        return abs(alert.at.timeIntervalSince(startedAt)) < 5
    }

    /// Crew message received during this emergency (shown here silently: no haptic while measuring).
    private var crewMessage: ReceivedCrewHaptic? {
        guard let crew = bridge.lastCrewHaptic, let startedAt = bridge.emergencyStartedAt,
            crew.receivedAt >= startedAt
        else { return nil }
        return crew
    }
}

#Preview {
    MonitorView()
        .environment(WatchBridge(activate: false))
}
