import SwiftUI

struct MonitorView: View {
    @Environment(WatchBridge.self) private var bridge
    @State private var monitor = PatientMonitor()
    @State private var center = EmergencyCenter.shared
    @State private var confirmingEnd = false

    static let spo2StaleAfterMin: Double = 30

    var body: some View {
        ScrollViewReader { proxy in
            content
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
                header
                if isAlertQueued {
                    queuedAlertNotice
                }
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
                if let alert = center.lastAlert, isCurrent(alert) {
                    SentAlertSummary(alert: alert, compact: true)
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
        .id(bridge.status?.payload.language ?? Language.current.rawValue)
        .clockBand()
        .background(Theme.background)
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
            .padding(.bottom, Theme.cornerInset)
        } else {
            Button(L("Terminar", "End")) {
                confirmingEnd = true
            }
            .buttonStyle(.haven(.secondary))
            .accessibilityLabel(L("Terminar emergencia", "End emergency"))
        }
    }

    private var isAlertQueued: Bool {
        guard let alert = center.lastAlert, isCurrent(alert) else { return false }
        return alert.queued && !bridge.isReachable
    }

    private var queuedAlertNotice: some View {
        LevelBadge(level: .red, text: L("En cola · pide ayuda", "Queued · call for help"))
            .accessibilityLabel(
                L(
                    "Aviso en cola: se enviará al reconectar. Pide ayuda en voz alta.",
                    "Alert queued: it will be sent on reconnect. Call for help out loud."))
    }

    private var sendingText: String {
        guard bridge.isReachable else {
            return L("Lecturas en cola hasta reconectar", "Readings queued until reconnect")
        }
        guard monitor.lastSentAt != nil else { return L("Preparando envío al iPhone", "Preparing to send") }
        let seconds = Int(PatientMonitor.sendInterval.components.seconds)
        return L("Enviando al iPhone cada \(seconds) s", "Sending to the iPhone every \(seconds) s")
    }

    private func isCurrent(_ alert: EmergencyCenter.SentAlert) -> Bool {
        guard let startedAt = bridge.emergencyStartedAt else { return false }
        return abs(alert.at.timeIntervalSince(startedAt)) < 5
    }

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
