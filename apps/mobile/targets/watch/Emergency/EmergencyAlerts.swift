import SwiftUI

extension View {
    func emergencyAlerts() -> some View { modifier(EmergencyAlerts()) }
}

private struct EmergencyAlertsInstalledKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    fileprivate var emergencyAlertsInstalled: Bool {
        get { self[EmergencyAlertsInstalledKey.self] }
        set { self[EmergencyAlertsInstalledKey.self] = newValue }
    }
}

private struct EmergencyAlerts: ViewModifier {
    @Environment(\.emergencyAlertsInstalled) private var installed

    func body(content: Content) -> some View {
        if installed {
            content
        } else {
            EmergencyAlertsHost(content: content.environment(\.emergencyAlertsInstalled, true))
        }
    }
}

private struct EmergencyAlertsHost<Content: View>: View {
    let content: Content

    @Environment(WatchBridge.self) private var bridge
    @State private var center = EmergencyCenter.shared
    @State private var crewNotice: ReceivedCrewHaptic?

    var body: some View {
        content
            .task { center.start(bridge: bridge) }
            .fullScreenCover(item: pendingBinding) { trigger in
                AutoTriggerView(trigger: trigger)
            }
            .sheet(item: $crewNotice) { notice in
                CrewNoticeView(notice: notice)
            }
            .onChange(of: bridge.isEmergencyActive) { _, isActive in
                if isActive { center.joinActiveEmergency() }
            }
            .onChange(of: bridge.lastCrewHaptic) { _, notice in
                guard let notice, !bridge.isEmergencyActive, center.pendingTrigger == nil else { return }
                crewNotice = notice
            }
    }

    private var pendingBinding: Binding<EmergencyCenter.PendingTrigger?> {
        Binding(
            get: { center.pendingTrigger },
            set: { if $0 == nil { center.imOK() } }
        )
    }
}

struct AutoTriggerView: View {
    let trigger: EmergencyCenter.PendingTrigger

    @State private var center = EmergencyCenter.shared

    var body: some View {
        VStack(spacing: Spacing.m) {
            VStack(spacing: Spacing.xs) {
                HStack(spacing: Spacing.s) {
                    Image(systemName: Level.red.symbol)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Theme.red)
                        .accessibilityHidden(true)
                    Text(trigger.origin.title)
                        .font(Typography.titleSmall)
                        .foregroundStyle(Theme.foreground)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                }
                if let detail = trigger.detail {
                    Text(detail)
                        .font(Typography.caption)
                        .foregroundStyle(Theme.mutedForeground)
                        .monospacedDigit()
                }
            }
            Countdown(seconds: AutoTriggerThresholds.countdownSeconds) {
                center.confirmPending()
            }
            .frame(width: 88, height: 88)
            Button(L("Estoy bien", "I'm OK")) {
                center.imOK()
            }
            .buttonStyle(.haven())
        }
        .havenScreen()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            L(
                "Se avisará a tu tripulación salvo que digas que estás bien",
                "Your crew will be alerted unless you are OK"))
    }
}

extension ReceivedCrewHaptic: Identifiable {
    var id: Date { receivedAt }
}

private struct CrewNoticeView: View {
    let notice: ReceivedCrewHaptic

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.m) {
                LevelBadge(level: .red, text: L("Aviso de tripulación", "Crew alert"))
                Text(notice.message)
                    .font(Typography.title)
                    .foregroundStyle(Theme.foreground)
                    .fixedSize(horizontal: false, vertical: true)
                AgeLabel(since: notice.receivedAt)
                Button(L("Entendido", "Got it")) { dismiss() }
                    .buttonStyle(.haven())
            }
            .havenScreen()
        }
        .background(Theme.background)
    }
}

#Preview("Automatic trigger") {
    AutoTriggerView(
        trigger: EmergencyCenter.PendingTrigger(origin: .heartRate, detectedAt: .now, detail: "168 lpm")
    )
    .environment(WatchBridge(activate: false))
}
