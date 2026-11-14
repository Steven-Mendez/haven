import ExpoModulesCore
import WatchConnectivity
import os

// Lado iPhone del puente WatchConnectivity. Mensajes: ["json": WatchEnvelope] (packages/shared/src/watch.ts).

private let messageEvent = "onMessage"
private let reachabilityEvent = "onReachabilityChange"
private let jsonKey = "json"
private let log = Logger(subsystem: "haven.watch-bridge", category: "phone")

/// Activa la sesión antes de que cargue JS para no perder mensajes encolados.
public class HavenWatchAppDelegate: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    PhoneWatchSession.shared.activate()
    return true
  }
}

public class HavenWatchModule: Module {
  private let session = PhoneWatchSession.shared

  public func definition() -> ModuleDefinition {
    Name("HavenWatch")

    Events(messageEvent, reachabilityEvent)

    // Tras un reload de JS solo la instancia más reciente recibe eventos.
    OnCreate {
      session.attach(
        owner: self,
        onReceive: { [weak self] json in self?.sendEvent(messageEvent, [jsonKey: json]) },
        onReachabilityChange: { [weak self] reachable in
          self?.sendEvent(reachabilityEvent, ["reachable": reachable])
        }
      )
      session.activate()
    }

    OnStartObserving(messageEvent) { self.session.setListening(true, owner: self) }
    OnStopObserving(messageEvent) { self.session.setListening(false, owner: self) }
    OnDestroy { self.session.detach(owner: self) }

    Function("isAvailable") { () -> Bool in
      WCSession.isSupported() && WCSession.default.activationState == .activated
    }

    Function("isPaired") { () -> Bool in
      guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return false }
      return WCSession.default.isPaired && WCSession.default.isWatchAppInstalled
    }

    Function("isReachable") { () -> Bool in
      WCSession.isSupported() && WCSession.default.isReachable
    }

    Function("send") { (json: String) in self.session.send(json) }

    Function("updateContext") { (json: String) in self.session.updateContext(json) }
  }
}

/// Encola lo saliente hasta que la sesión se active y lo entrante hasta que JS escuche.
final class PhoneWatchSession: NSObject, WCSessionDelegate {
  static let shared = PhoneWatchSession()

  private let lock = NSLock()
  private var pendingOutgoing: [() -> Void] = []
  private var pendingIncoming: [String] = []
  private var listening = false
  private weak var owner: AnyObject?
  private var onReceive: ((String) -> Void)?
  private var onReachabilityChange: ((Bool) -> Void)?

  func attach(owner: AnyObject, onReceive: @escaping (String) -> Void, onReachabilityChange: @escaping (Bool) -> Void) {
    lock.withLock {
      self.owner = owner
      self.onReceive = onReceive
      self.onReachabilityChange = onReachabilityChange
      listening = false
    }
  }

  func detach(owner: AnyObject) {
    lock.withLock {
      guard self.owner === owner else { return }
      self.owner = nil
      onReceive = nil
      onReachabilityChange = nil
      listening = false
    }
  }

  func setListening(_ value: Bool, owner: AnyObject) {
    let (flush, callback): ([String], ((String) -> Void)?) = lock.withLock {
      guard self.owner === owner else { return ([], nil) }
      listening = value
      guard value, onReceive != nil else { return ([], nil) }
      defer { pendingIncoming.removeAll() }
      return (pendingIncoming, onReceive)
    }
    for json in flush { callback?(json) }
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate === self, session.activationState != .notActivated { return }
    session.delegate = self
    session.activate()
  }

  /// Ejecuta `work` ahora si la sesión está activa; si no, al activarse.
  private func whenActivated(_ work: @escaping () -> Void) -> Bool {
    guard WCSession.isSupported() else { return false }
    if WCSession.default.activationState == .activated { return true }
    lock.withLock { pendingOutgoing.append(work) }
    activate()
    return false
  }

  func send(_ json: String) {
    guard whenActivated({ [weak self] in self?.send(json) }) else { return }
    let session = WCSession.default
    let message: [String: Any] = [jsonKey: json]
    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { error in
        log.error("sendMessage falló (\(error.localizedDescription, privacy: .public)); uso transferUserInfo")
        session.transferUserInfo(message)
      }
    } else if session.isPaired, session.isWatchAppInstalled {
      session.transferUserInfo(message)
    }
  }

  func updateContext(_ json: String) {
    guard whenActivated({ [weak self] in self?.updateContext(json) }) else { return }
    do {
      try WCSession.default.updateApplicationContext([jsonKey: json])
    } catch {
      log.error("updateApplicationContext falló: \(error.localizedDescription, privacy: .public)")
    }
  }

  private func receive(_ dictionary: [String: Any]) {
    guard let json = dictionary[jsonKey] as? String else { return }
    let callback: ((String) -> Void)? = lock.withLock {
      guard listening, owner != nil, let onReceive else {
        pendingIncoming.append(json)
        return nil
      }
      return onReceive
    }
    callback?(json)
  }

  private func notifyReachability(_ reachable: Bool) {
    let callback = lock.withLock { onReachabilityChange }
    callback?(reachable)
  }

  // MARK: WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    if let error {
      log.error("Activación de WCSession falló: \(error.localizedDescription, privacy: .public)")
      return
    }
    let pending: [() -> Void] = lock.withLock {
      defer { pendingOutgoing.removeAll() }
      return pendingOutgoing
    }
    pending.forEach { $0() }
    notifyReachability(session.isReachable)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
  func sessionReachabilityDidChange(_ session: WCSession) { notifyReachability(session.isReachable) }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { receive(message) }
  func session(
    _ session: WCSession, didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    receive(message)
    replyHandler(["ok": true])
  }
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) { receive(userInfo) }
  func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) { receive(context) }
}
