import SwiftUI

// Mismo modelo que packages/shared/src/index.ts
struct Item: Codable, Identifiable {
  let _id: String
  let title: String
  let done: Bool
  let createdAt: String
  var id: String { _id }
}

// Simulador: localhost apunta a tu Mac. Reloj físico: usa la IP LAN o la URL desplegada.
let API_URL = "http://localhost:3000"

@MainActor
final class ItemsModel: ObservableObject {
  @Published var items: [Item] = []
  @Published var error: String?

  func load() async {
    do {
      let (data, _) = try await URLSession.shared.data(from: URL(string: "\(API_URL)/api/items")!)
      items = try JSONDecoder().decode([Item].self, from: data)
      error = nil
    } catch {
      self.error = error.localizedDescription
    }
  }

  func add() async {
    var req = URLRequest(url: URL(string: "\(API_URL)/api/items")!)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try? JSONEncoder().encode(["title": "Item desde el Watch"])
    _ = try? await URLSession.shared.data(for: req)
    await load()
  }
}

struct ContentView: View {
  @StateObject private var model = ItemsModel()

  var body: some View {
    NavigationStack {
      List {
        Button {
          Task { await model.add() }
        } label: {
          Label("Agregar", systemImage: "plus.circle.fill")
        }
        if let error = model.error {
          Text(error).font(.footnote).foregroundStyle(.red)
        }
        ForEach(model.items) { item in
          Text(item.title)
        }
      }
      .navigationTitle("HAVEN")
      .refreshable { await model.load() }
      .task { await model.load() }
    }
  }
}
