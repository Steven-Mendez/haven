import SwiftUI

/// Pantalla raíz: navega a las features. Cada feature vive en Features/<nombre>/.
struct ContentView: View {
  var body: some View {
    NavigationStack {
      ItemsView()
    }
  }
}
