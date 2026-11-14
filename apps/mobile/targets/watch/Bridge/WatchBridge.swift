import Foundation
import Observation
import WatchConnectivity
import os

// Lado reloj del puente WatchConnectivity. Uso: @Environment(WatchBridge.self) private var bridge

private let log = Logger(subsystem: "haven.watch-bridge", category: "watch")

@MainActor
@Observable
final class WatchBridge: NSObject {
  private(set) var items: [Item] = []
  private(set) var isReachable = false
  private(set) var lastUpdate: Date?

  @ObservationIgnored private let decoder = JSONDecoder()
  @ObservationIgnored private let encoder = JSONEncoder()

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.delegate == nil else { return }
    session.delegate = self
    session.activate()
  }

  // MARK: Enviar (reloj → iPhone)

  func addItem(_ title: String) { send(WatchEnvelope(.addItem, AddItemPayload(title: title))) }

  func requestSync() { send(WatchEnvelope(.sync, SyncPayload())) }

  private func send<P: Codable>(_ envelope: WatchEnvelope<P>) {
    guard let data = try? encoder.encode(envelope), let json = String(data: data, encoding: .utf8) else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    let message = [WatchContract.jsonKey: json]
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { error in
        log.error("sendMessage falló: \(error.localizedDescription, privacy: .public); uso transferUserInfo")
        session.transferUserInfo(message)
      }
    } else {
      session.transferUserInfo(message)
    }
  }

  // MARK: Recibir (iPhone → reloj)

  private func handle(json: String) {
    guard let data = json.data(using: .utf8),
      let header = try? decoder.decode(EnvelopeHeader.self, from: data)
    else {
      log.error("Sobre inválido: \(json, privacy: .public)")
      return
    }
    switch header.type {
    case .items:
      if let envelope = try? decoder.decode(WatchEnvelope<ItemsPayload>.self, from: data) {
        items = envelope.payload.items
        lastUpdate = Date()
      }
    case .addItem, .sync:
      break
    }
  }
}

extension WatchBridge: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?
  ) {
    let json = session.receivedApplicationContext[WatchContract.jsonKey] as? String
    let reachable = session.isReachable
    Task { @MainActor in
      self.isReachable = reachable
      if let json { self.handle(json: json) }
      self.requestSync()
    }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    let reachable = session.isReachable
    Task { @MainActor in self.isReachable = reachable }
  }

  nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    receive(message)
  }

  nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    receive(userInfo)
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
    receive(context)
  }

  nonisolated private func receive(_ dictionary: [String: Any]) {
    guard let json = dictionary[WatchContract.jsonKey] as? String else { return }
    Task { @MainActor in self.handle(json: json) }
  }
}
