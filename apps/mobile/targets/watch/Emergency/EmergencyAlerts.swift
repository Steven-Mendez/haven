import SwiftUI

// W03 (Deneb) · App-wide emergency presentations:
//   • automatic trigger: full-screen 15 s countdown with the origin title and «Estoy bien» (DISENO.md §4, W03);
//   • `crewHaptic` received from the phone: a sheet with the message (the bridge already played the haptic).
//     During the monitor (W04) there is neither haptic nor sheet: MonitorView shows the message inline.
// It also starts `EmergencyCenter` (reading sources and DEBUG triggers).
//
// Apply it once, at the root (ContentView does): `.emergencyAlerts()`. It is idempotent: an inner application below
// an outer one does nothing.
// Motion is limited to the countdown ring (linear; stepped with Reduce Motion).

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

    /// The cover has no system ✕ (AutoTriggerView hides it); if the system closes it anyway, it counts as «Estoy bien».
    private var pendingBinding: Binding<EmergencyCenter.PendingTrigger?> {
        Binding(
            get: { center.pendingTrigger },
            set: { if $0 == nil { center.imOK() } }
        )
    }
}

// MARK: - Automatic trigger countdown

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
            // The safe way out is the primary (white) action: inside an emergency the main button is never red.
            Button(L("Estoy bien", "I'm OK")) {
                center.imOK()
            }
            .buttonStyle(.haven())
        }
        // Rounded display corners (DISENO.md §2.1): screen margin and the bottom corner inset.
        .havenScreen()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
        // No system ✕ over the title: «Estoy bien» is the explicit way out.
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            L(
                "Se avisará a tu tripulación salvo que digas que estás bien",
                "Your crew will be alerted unless you are OK"))
    }
}

// MARK: - Crew notice

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
