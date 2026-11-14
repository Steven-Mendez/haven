import SwiftUI
import os

@main
struct HavenWatchApp: App {
    @WKApplicationDelegateAdaptor private var appDelegate: WatchAppDelegate
    private var bridge: WatchBridge { appDelegate.bridge }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(bridge)
                .task { await runSelfTestIfRequested() }
        }
    }

    private func runSelfTestIfRequested() async {
        #if DEBUG
            let requested =
                CommandLine.arguments.contains("-havenSelfTest")
                || ProcessInfo.processInfo.environment["HAVEN_SELF_TEST"] == "1"
            guard requested else { return }
            Logger(subsystem: "app.haven.watch", category: "bridge").info("Self-test: sending mood and emergency")
            try? await Task.sleep(for: .seconds(4))
            bridge.sendMood(4)
            try? await Task.sleep(for: .seconds(1))
            bridge.startEmergency(.button)
        #endif
    }
}
