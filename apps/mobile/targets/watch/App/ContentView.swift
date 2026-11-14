import SwiftUI

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
