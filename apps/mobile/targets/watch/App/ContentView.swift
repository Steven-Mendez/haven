import SwiftUI

// Watch navigation (W00): the watch does only what the iPhone and the stock Apple Watch cannot: raise the alarm.
// Routine monitoring needs no app here (HealthKit syncs the watch's readings to the iPhone, which assesses them).
//   One screen: SOS (hold 3 s), with the automatic triggers below the fold (EmergencyView).
//   `.emergencyAlerts()`: automatic trigger countdowns and crew notices over any screen.
//   MonitorView: full-screen cover while `bridge.isEmergencyActive` (live pulse streamed to the iPhone).
// Every view reads the bridge with `@Environment(WatchBridge.self)` (API in Bridge/WatchBridge.swift).
struct ContentView: View {
    @Environment(WatchBridge.self) private var bridge

    var body: some View {
        NavigationStack {
            EmergencyView()
                .background(Theme.background)
        }
        .tint(Theme.primary)
        .emergencyAlerts()
        .fullScreenCover(isPresented: emergencyBinding) {
            MonitorView()
        }
    }

    /// Dismissing the cover (or the system closing it) ends the emergency on this watch.
    private var emergencyBinding: Binding<Bool> {
        Binding(
            get: { bridge.isEmergencyActive },
            set: { isPresented in
                if !isPresented { bridge.endEmergency() }
            }
        )
    }
}

#Preview {
    ContentView()
        .environment(WatchBridge(activate: false))
}
