import Foundation

// Espejo de packages/shared/src/watch.ts: mantener ambos iguales.

enum WatchContract {
  static let version = 1
  static let jsonKey = "json"
}

enum WatchMessageType: String, Codable {
  case items, addItem, sync
}

struct Item: Codable, Identifiable, Equatable {
  let _id: String
  let title: String
  let done: Bool
  let createdAt: String
  var id: String { _id }
}

struct ItemsPayload: Codable { let items: [Item] }
struct AddItemPayload: Codable { let title: String }
struct SyncPayload: Codable {}

struct WatchEnvelope<Payload: Codable>: Codable {
  let v: Int
  let type: WatchMessageType
  let sentAt: String
  let payload: Payload

  init(_ type: WatchMessageType, _ payload: Payload) {
    v = WatchContract.version
    self.type = type
    sentAt = ISO8601DateFormatter().string(from: Date())
    self.payload = payload
  }
}

struct EnvelopeHeader: Codable {
  let v: Int
  let type: WatchMessageType
}
