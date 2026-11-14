import ExpoModulesCore
import HealthKit
import WatchConnectivity
import os

// Contract C · native module HavenWatch (W00).
// iPhone side of the WatchConnectivity bridge. Messages travel as a dictionary
// `["json": <serialized WatchEnvelope>]`; the watch side (targets/watch/Bridge/WatchBridge.swift) uses the same key.
//
//   isAvailable()  → WCSession supported and activated
//   isPaired()     → isPaired && isWatchAppInstalled
//   isReachable()  → isReachable (watch app in the foreground)
//   send(json)     → sendMessage when reachable; otherwise (or if it fails) transferUserInfo.
//                    `status` envelopes also go through updateApplicationContext.
//   startWatchMonitor() → Promise<boolean>: HKHealthStore.startWatchApp(with:) wakes the watch app, which opens the
//                    patient monitor (emergency started on the phone). false if HealthKit/the watch is unavailable.
//   onMessage              → { json }       envelope received (didReceiveMessage / UserInfo / ApplicationContext)
//   onReachabilityChange   → { reachable }  isReachable changes

let messageEvent = "onMessage"
let reachabilityEvent = "onReachabilityChange"
let jsonKey = "json"
let log = Logger(subsystem: "app.haven.mobile.watch", category: "bridge")

/// Activates the WCSession at app launch, before JS loads the module: transferUserInfo / applicationContext the
/// watch queued while the app was closed are delivered right away and buffered until JS listens to `onMessage`.
public class HavenWatchAppDelegate: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        PhoneWatchSession.shared.activate()
        #if DEBUG
            // `SIMCTL_CHILD_HAVEN_START_WATCH_MONITOR=1 xcrun simctl launch <phone> app.haven.mobile` tests
            // startWatchMonitor() without JS: wakes the watch app 8 s after launch.
            if ProcessInfo.processInfo.environment["HAVEN_START_WATCH_MONITOR"] == "1" {
                DispatchQueue.main.asyncAfter(deadline: .now() + 8) {
                    HavenWatchModule.startWatchMonitor { _ in }
                }
            }
        #endif
        return true
    }
}

public class HavenWatchModule: Module {
    private let session = PhoneWatchSession.shared
    private static let healthStore = HKHealthStore()

    /// Wakes the watch app with a workout configuration (WatchAppDelegate.handle opens the patient monitor).
    static func startWatchMonitor(completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            log.info("startWatchMonitor: HealthKit not available")
            completion(false)
            return
        }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .other
        configuration.locationType = .indoor
        healthStore.startWatchApp(with: configuration) { success, error in
            if let error {
                log.error("startWatchApp failed: \(error.localizedDescription, privacy: .public)")
            } else {
                log.info("startWatchApp: \(success)")
            }
            completion(success)
        }
    }

    public func definition() -> ModuleDefinition {
        Name("HavenWatch")

        Events(messageEvent, reachabilityEvent)

        // Castor (QA): the session is a singleton but a JS reload creates a new module instance, and the old
        // instance's OnDestroy / OnStopObserving can run after the new one's OnCreate / OnStartObserving. Callbacks
        // and listening are therefore tied to the owning instance: calls from a stale instance are ignored.
        OnCreate {
            session.attach(
                owner: self,
                onReceive: { [weak self] json in self?.sendEvent(messageEvent, [jsonKey: json]) },
                onReachabilityChange: { [weak self] reachable in
                    self?.sendEvent(reachabilityEvent, ["reachable": reachable])
                }
            )
            session.activate()  // no-op when the app delegate subscriber already did it
        }

        OnStartObserving(messageEvent) {
            self.session.setListening(true, owner: self)
        }

        OnStopObserving(messageEvent) {
            self.session.setListening(false, owner: self)
        }

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

        Function("send") { (json: String) in
            self.session.send(json)
        }

        AsyncFunction("startWatchMonitor") { (promise: Promise) in
            HavenWatchModule.startWatchMonitor { promise.resolve($0) }
        }

        OnDestroy {
            self.session.detach(owner: self)
        }
    }
}

/// WCSession delegate. Holds outgoing envelopes until the session activates and incoming ones until JS
/// subscribes to `onMessage`, so nothing is lost at startup.
final class PhoneWatchSession: NSObject, WCSessionDelegate {
    static let shared = PhoneWatchSession()

    private let lock = NSLock()
    private var pendingOutgoing: [String] = []
    private var pendingIncoming: [String] = []
    private var recentlyReceived: [String] = []
    /// Latest application context, one entry per type: `json` = last `status` (key kept for older watch builds),
    /// `emergencyEnd` = last emergency end. updateApplicationContext replaces the whole dictionary, so it is merged.
    private var context: [String: String] = [:]
    private var listening = false
    /// Module instance whose JS runtime receives the events (the latest one created).
    private weak var owner: AnyObject?
    private var onReceive: ((String) -> Void)?
    private var onReachabilityChange: ((Bool) -> Void)?

    /// A new module instance (app start or JS reload) takes over; incoming envelopes are buffered until its JS
    /// subscribes to `onMessage`.
    func attach(
        owner: AnyObject, onReceive: @escaping (String) -> Void, onReachabilityChange: @escaping (Bool) -> Void
    ) {
        lock.withLock {
            self.owner = owner
            self.onReceive = onReceive
            self.onReachabilityChange = onReachabilityChange
            listening = false
        }
    }

    /// Only the current owner can clear the callbacks (a stale instance destroyed after a reload is ignored).
    func detach(owner: AnyObject) {
        lock.withLock {
            guard self.owner === owner else { return }
            self.owner = nil
            onReceive = nil
            onReachabilityChange = nil
            listening = false
        }
    }

    /// JS of the current owner started or stopped observing `onMessage`. Starting flushes the buffer.
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

    private func notifyReachability(_ reachable: Bool) {
        let callback = lock.withLock { onReachabilityChange }
        callback?(reachable)
    }

    func activate() {
        guard WCSession.isSupported() else {
            log.info("WatchConnectivity is not supported on this device")
            return
        }
        let session = WCSession.default
        if session.delegate === self, session.activationState != .notActivated { return }
        session.delegate = self
        session.activate()
    }

    func send(_ json: String) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else {
            lock.withLock { pendingOutgoing.append(json) }
            if session.activationState == .notActivated { activate() }
            return
        }
        let message: [String: Any] = [jsonKey: json]
        let type = Self.type(of: json) ?? "?"

        // `status` and `emergencyEnd` are states, not events: they also go through the application context, which
        // the watch gets as soon as its app runs (transferUserInfo is not delivered between simulators and can be
        // late on a device; a watch left in the monitor must still learn that the emergency ended).
        if let contextKey = Self.contextKeys[type] {
            let merged: [String: String] = lock.withLock {
                context[contextKey] = json
                return context
            }
            do {
                try session.updateApplicationContext(merged)
            } catch {
                log.error("updateApplicationContext failed: \(error.localizedDescription, privacy: .public)")
            }
        }

        // A reachable watch app is running, so it is installed even if `isWatchAppInstalled` has not caught up yet
        // (seen on simulators while the watch already streams its pulse): send right away.
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { error in
                log.error(
                    "sendMessage failed (\(error.localizedDescription, privacy: .public)); falling back to transferUserInfo"
                )
                session.transferUserInfo(message)
            }
            log.info("Sent via sendMessage: \(type, privacy: .public)")
            return
        }

        // transferUserInfo needs the watch app installed; otherwise there is nobody to deliver to.
        guard session.isPaired, session.isWatchAppInstalled else {
            log.info("No paired watch with the app installed: \(type, privacy: .public) not sent")
            return
        }
        session.transferUserInfo(message)
        log.info("Queued via transferUserInfo: \(type, privacy: .public)")
    }

    private static let contextKeys = ["status": jsonKey, "emergencyEnd": "emergencyEnd"]

    private static func type(of json: String) -> String? {
        guard let data = json.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return object["type"] as? String
    }

    private func receive(_ dictionary: [String: Any], via channel: String) {
        guard let json = dictionary[jsonKey] as? String else {
            log.error("Message without json key via \(channel, privacy: .public)")
            return
        }
        // The watch resends queued envelopes with sendMessage when the iPhone becomes reachable, so the same envelope
        // can also arrive later through transferUserInfo: drop exact duplicates.
        let isDuplicate: Bool = lock.withLock {
            if recentlyReceived.contains(json) { return true }
            recentlyReceived.append(json)
            if recentlyReceived.count > 200 { recentlyReceived.removeFirst() }
            return false
        }
        if isDuplicate {
            log.info("Duplicate dropped (via \(channel, privacy: .public))")
            return
        }
        log.info("Received via \(channel, privacy: .public): \(json, privacy: .public)")
        // Without a listening JS runtime (startup, or between a reload's destroy and create) keep it for later.
        let callback: ((String) -> Void)? = lock.withLock {
            guard listening, owner != nil, let onReceive else {
                pendingIncoming.append(json)
                return nil
            }
            return onReceive
        }
        callback?(json)
    }

    // MARK: WCSessionDelegate

    func session(
        _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            log.error("WCSession activation failed: \(error.localizedDescription, privacy: .public)")
            return
        }
        log.info(
            "WCSession activated: paired=\(session.isPaired) installed=\(session.isWatchAppInstalled) reachable=\(session.isReachable)"
        )
        let pending: [String] = lock.withLock {
            defer { pendingOutgoing.removeAll() }
            return pendingOutgoing
        }
        for json in pending { send(json) }
        notifyReachability(session.isReachable)
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // The paired watch changed: reactivate for the new one.
        WCSession.default.activate()
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        log.info("Watch state: paired=\(session.isPaired) installed=\(session.isWatchAppInstalled)")
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        log.info("Reachable: \(session.isReachable)")
        notifyReachability(session.isReachable)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        receive(message, via: "sendMessage")
    }

    func session(
        _ session: WCSession, didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        receive(message, via: "sendMessage")
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        receive(userInfo, via: "transferUserInfo")
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        receive(applicationContext, via: "applicationContext")
    }
}
