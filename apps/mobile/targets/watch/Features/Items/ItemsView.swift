import SwiftUI

/// Feature de ejemplo; sirve de plantilla para nuevas features.
struct ItemsView: View {
  @Environment(WatchBridge.self) private var bridge

  var body: some View {
    List {
      Button {
        bridge.addItem("Item desde el Watch")
      } label: {
        Label("Agregar", systemImage: "plus.circle.fill")
      }

      if !bridge.isReachable {
        Label("Abre HAVEN en el iPhone", systemImage: "iphone.slash")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }

      ForEach(bridge.items) { item in
        Text(item.title)
      }
    }
    .navigationTitle("HAVEN")
    .refreshable { bridge.requestSync() }
  }
}
