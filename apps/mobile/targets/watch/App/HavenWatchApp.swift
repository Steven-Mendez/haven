import SwiftUI

@main
struct HavenWatchApp: App {
  @State private var bridge = WatchBridge()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environment(bridge)
        .task { bridge.activate() }
    }
  }
}
