import Foundation
import Observation
import WatchConnectivity
import WatchKit
import os

struct ReceivedStatus: Codable, Equatable {
    let payload: StatusPayload
    let receivedAt: Date
    let sentAt: String

    private enum CodingKeys: String, CodingKey {
        case payload, receivedAt, sentAt
    }

    var evaluatedAt: Date { ISODate.date(payload.evaluatedAt) ?? receivedAt }

    func age(now: Date = .now) -> TimeInterval { now.timeIntervalSince(evaluatedAt) }
}

struct ReceivedCrewHaptic: Equatable {
    let message: String
    let receivedAt: Date
}

@Observable
final class WatchBridge: NSObject {
    private(set) var status: ReceivedStatus?
    private(set) var isReachable = false
    private(set) var isActivated = false
    private(set) var lastCrewHaptic: ReceivedCrewHaptic?
    private(set) var crewMember: String

    var missionSession: StatusPayload.Session { status?.payload.session ?? .active }
    var mutesHaptics = false
    private(set) var isEmergencyActive = false
    private(set) var emergencyOrigin: EmergencyPayload.Origin?
    private(set) var emergencyStartedAt: Date?

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let session: WCSession?
    @ObservationIgnored private var pendingOutgoing: [String] = []
    @ObservationIgnored private var outbox: [String] = []
    @ObservationIgnored private var isFlushingOutbox = false
    private static let outboxLimit = 100
    @ObservationIgnored private let log = Logger(subsystem: "app.haven.watch", category: "bridge")
    #if DEBUG
        @ObservationIgnored private let forceOffline = ProcessInfo.processInfo.environment["HAVEN_FORCE_OFFLINE"] == "1"
    #else
        @ObservationIgnored private let forceOffline = false
    #endif

    private enum Key {
        static let status = "haven.bridge.status"
        static let crewMember = "haven.bridge.crewMember"
        static let outbox = "haven.bridge.outbox"
    }

    static let defaultCrewMember = "elena-vega"

    init(defaults: UserDefaults = .standard, activate: Bool = true) {
        self.defaults = defaults
        self.session = WCSession.isSupported() ? WCSession.default : nil
        self.crewMember = defaults.string(forKey: Key.crewMember) ?? Self.defaultCrewMember
        if let data = defaults.data(forKey: Key.status) {
            self.status = try? JSONDecoder().decode(ReceivedStatus.self, from: data)
        }
        self.outbox = defaults.stringArray(forKey: Key.outbox) ?? []
        super.init()
        if let language = status?.payload.language.flatMap(Language.init(rawValue:)) { Language.current = language }
        if activate, let session {
            session.delegate = self
            session.activate()
        }
    }

    func sendMood(_ score: Int, takenAt: Date = .now) {
        send(MoodPayload(score: min(max(score, 1), 5), takenAt: ISODate.string(takenAt)))
    }

    func sendEmergency(
        _ origin: EmergencyPayload.Origin = .button, takenAt: Date = .now,
        reading: EmergencyCenter.TriggerReading? = nil
    ) {
        send(
            EmergencyPayload(
                origin: origin, takenAt: ISODate.string(takenAt), heartRate: reading?.heartRate,
                spo2: reading?.spo2, readingAt: reading.map { ISODate.string($0.takenAt) }))
    }

    func sendMonitor(heartRate: Double, spo2: Double? = nil, spo2TakenAt: Date? = nil, takenAt: Date = .now) {
        send(
            MonitorPayload(
                heartRate: heartRate,
                takenAt: ISODate.string(takenAt),
                spo2: spo2,
                spo2TakenAt: spo2TakenAt.map(ISODate.string)
            )
        )
    }

    func startEmergency(
        _ origin: EmergencyPayload.Origin? = .button, at date: Date = .now, notifyPhone: Bool = true,
        reading: EmergencyCenter.TriggerReading? = nil
    ) {
        guard !isEmergencyActive else { return }
        isEmergencyActive = true
        emergencyOrigin = origin
        emergencyStartedAt = date
        if notifyPhone, let origin { sendEmergency(origin, takenAt: date, reading: reading) }
    }

    func endEmergency() {
        isEmergencyActive = false
        emergencyOrigin = nil
        emergencyStartedAt = nil
        mutesHaptics = false
    }

    func send<Payload: WatchPayload>(_ payload: Payload) {
        let envelope = WatchEnvelope(
            crewMember: crewMember,
            sentAt: ISODate.string(.now),
            payload: payload
        )
        guard let data = try? JSONEncoder().encode(envelope), let json = String(data: data, encoding: .utf8)
        else {
            log.error("Could not encode \(Payload.type.rawValue, privacy: .public)")
            return
        }
        send(json: json)
    }

    private func send(json: String) {
        guard let session else {
            log.info("WatchConnectivity not supported: envelope dropped")
            return
        }
        guard session.activationState == .activated else {
            pendingOutgoing.append(json)
            log.info("Session not activated yet: envelope queued")
            return
        }
        let message: [String: Any] = [WatchContract.jsonKey: json]
        if session.isReachable && !forceOffline {
            session.sendMessage(message, replyHandler: nil) { [weak self] error in
                DispatchQueue.main.async {
                    self?.log.error(
                        "sendMessage failed (\(error.localizedDescription, privacy: .public)); transferUserInfo")
                    self?.enqueue(json, on: session)
                }
            }
            log.info("Sent via sendMessage: \(json, privacy: .public)")
        } else {
            enqueue(json, on: session)
        }
    }

    private func enqueue(_ json: String, on session: WCSession) {
        session.transferUserInfo([WatchContract.jsonKey: json])
        if !outbox.contains(json) {
            outbox.append(json)
            if outbox.count > Self.outboxLimit { outbox.removeFirst(outbox.count - Self.outboxLimit) }
            saveOutbox()
        }
        log.info("Queued via transferUserInfo (outbox \(self.outbox.count)): \(json, privacy: .public)")
    }

    private func saveOutbox() { defaults.set(outbox, forKey: Key.outbox) }

    private func markDelivered(_ json: String, via channel: String) {
        guard let index = outbox.firstIndex(of: json) else { return }
        outbox.remove(at: index)
        saveOutbox()
        for transfer in session?.outstandingUserInfoTransfers ?? []
        where transfer.userInfo[WatchContract.jsonKey] as? String == json {
            transfer.cancel()
        }
        log.info("Delivered via \(channel, privacy: .public) (outbox \(self.outbox.count))")
    }

    private func flushOutbox() {
        guard let session, session.activationState == .activated, session.isReachable, !forceOffline,
            !outbox.isEmpty, !isFlushingOutbox
        else { return }
        isFlushingOutbox = true
        let pending = outbox
        log.info("iPhone reachable: resending \(pending.count) queued envelope(s) with sendMessage")
        let group = DispatchGroup()
        for json in pending {
            group.enter()
            session.sendMessage(
                [WatchContract.jsonKey: json],
                replyHandler: { [weak self] _ in
                    DispatchQueue.main.async {
                        self?.markDelivered(json, via: "sendMessage retry")
                        group.leave()
                    }
                },
                errorHandler: { [weak self] error in
                    DispatchQueue.main.async {
                        self?.log.error(
                            "Retry failed (\(error.localizedDescription, privacy: .public)); kept in outbox")
                        group.leave()
                    }
                })
        }
        group.notify(queue: .main) { [weak self] in self?.isFlushingOutbox = false }
    }

    func receive(_ dictionary: [String: Any], via channel: String) {
        guard let json = dictionary[WatchContract.jsonKey] as? String else {
            log.error("Message without json key via \(channel, privacy: .public)")
            return
        }
        receive(json: json, via: channel)
    }

    func receive(json: String, via channel: String) {
        guard let data = json.data(using: .utf8),
            let envelope = try? JSONDecoder().decode(AnyWatchEnvelope.self, from: data)
        else {
            log.error("Invalid envelope via \(channel, privacy: .public): \(json, privacy: .public)")
            return
        }
        guard envelope.v == WatchContract.version else {
            log.error("Unsupported contract version \(envelope.v)")
            return
        }
        log.info("Received \(envelope.type.rawValue, privacy: .public) via \(channel, privacy: .public)")
        updateCrewMember(envelope.crewMember)

        switch envelope.payload {
        case .status(let payload):
            if let current = status, current.sentAt > envelope.sentAt { return }
            let received = ReceivedStatus(
                payload: payload, receivedAt: .now, sentAt: envelope.sentAt)
            status = received
            if let data = try? JSONEncoder().encode(received) { defaults.set(data, forKey: Key.status) }
            if let language = payload.language.flatMap(Language.init(rawValue:)) { Language.current = language }
            ComplicationStore.publish(received)
        case .crewHaptic(let payload):
            lastCrewHaptic = ReceivedCrewHaptic(message: payload.message, receivedAt: .now)
            if !mutesHaptics { WKInterfaceDevice.current().play(.notification) }
        case .emergencyEnd(let payload):
            guard isEmergencyActive else { return }
            if let endedAt = ISODate.date(payload.endedAt), let startedAt = emergencyStartedAt, endedAt < startedAt {
                log.info("Ignored emergencyEnd older than the running emergency")
                return
            }
            endEmergency()
        case .mood, .emergency, .monitor:
            log.info("Ignored \(envelope.type.rawValue, privacy: .public): it goes from watch to phone")
        }
    }

    private func receiveContext(_ context: [String: Any]) {
        for key in context.keys.sorted() {
            guard let json = context[key] as? String else { continue }
            receive(json: json, via: "applicationContext")
        }
    }

    private func updateCrewMember(_ id: String) {
        guard !id.isEmpty, id != crewMember else { return }
        crewMember = id
        defaults.set(id, forKey: Key.crewMember)
    }

    private func didActivate(_ session: WCSession) {
        isActivated = true
        isReachable = session.isReachable && !forceOffline
        if !session.receivedApplicationContext.isEmpty {
            receiveContext(session.receivedApplicationContext)
        }
        let pending = pendingOutgoing
        pendingOutgoing.removeAll()
        for json in pending { send(json: json) }
        flushOutbox()
    }
}

extension WatchBridge: WCSessionDelegate {
    func session(
        _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            log.error("WCSession activation failed: \(error.localizedDescription, privacy: .public)")
        }
        log.info("WCSession activated (\(activationState.rawValue)) reachable=\(session.isReachable)")
        guard activationState == .activated else { return }
        DispatchQueue.main.async { self.didActivate(session) }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        log.info("Reachable: \(reachable)")
        DispatchQueue.main.async {
            self.isReachable = reachable && !self.forceOffline
            if self.isReachable { self.flushOutbox() }
        }
    }

    func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
        let json = userInfoTransfer.userInfo[WatchContract.jsonKey] as? String
        DispatchQueue.main.async {
            let pending = json.map { self.outbox.contains($0) } ?? false
            if let error {
                self.log.info("transferUserInfo ended: \(error.localizedDescription, privacy: .public)")
            } else {
                self.log.info("transferUserInfo reported delivered (kept in outbox: \(pending))")
            }
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.receive(message, via: "sendMessage") }
    }

    func session(
        _ session: WCSession, didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        DispatchQueue.main.async { self.receive(message, via: "sendMessage") }
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        DispatchQueue.main.async { self.receive(userInfo, via: "transferUserInfo") }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async { self.receiveContext(applicationContext) }
    }
}
