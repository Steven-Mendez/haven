import SwiftUI
import os

@main
struct HavenWatchApp: App {
    /// The delegate owns the single WatchConnectivity bridge (it also handles `startWatchApp` from the iPhone).
    @WKApplicationDelegateAdaptor private var appDelegate: WatchAppDelegate
    /// Views read the bridge with `@Environment(WatchBridge.self)`.
    private var bridge: WatchBridge { appDelegate.bridge }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(bridge)
                .task { await runSelfTestIfRequested() }
        }
    }

    /// DEBUG only: `xcrun simctl launch <watch> app.haven.mobile.watchkitapp -havenSelfTest` (or
    /// `SIMCTL_CHILD_HAVEN_SELF_TEST=1 xcrun simctl launch …`) sends a `mood` and starts an emergency a few seconds
    /// after launch, to test watch → phone without tapping the simulator.
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
