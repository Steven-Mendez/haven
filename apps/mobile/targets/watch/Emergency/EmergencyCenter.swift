import Foundation
import HealthKit
import Observation
import os

// W03 (Deneb) · Emergency coordinator for the watch: manual SOS, automatic triggers and the last alert sent.
//
// ─── API ────────────────────────────────────────────────────────────────────────────────────────
//   EmergencyCenter.shared.start(bridge:)      once (the `.emergencyAlerts()` modifier does it).
//   .send(.button)                             records `lastAlert` and calls `bridge.startEmergency(origin)`
//                                              (sends `emergency { origin }`; the monitor W04 opens).
//   .pendingTrigger                            automatic trigger waiting for its 15 s countdown («Estoy bien»).
//   .imOK() / .confirmPending()                dismiss it (snoozes that origin) or send it.
//   .report(heartRate:…) / .report(spo2:…) / .report(irregularRhythmAt:) / .report(fallAt:)   feed readings.
//   .enabledTriggers / .setEnabled(_:_:)       which automatic triggers are on (persisted, all on by default).
//
// Reading source: HealthKit anchored queries for heart-rate, SpO₂ and irregular-rhythm samples (the last
//   `maxReadingAge` and every new one) while the app runs. Heart rate counts as «at rest» unless HealthKit tags it
//   `HKHeartRateMotionContext.active`. Fall detection needs an Apple-granted entitlement (CMFallDetectionManager)
//   that HAVEN does not have, so there is no real `fall` source: only the DEBUG test below.
// DEBUG test triggers (the simulator has no sensors), 4 s after launch:
//     SIMCTL_CHILD_HAVEN_TRIGGER=heartRate|spo2|rhythm|fall|crewHaptic|emergencyEnd xcrun simctl launch <watch> …
//   (comma-separated for several, or `-havenTrigger <name>`). `heartRate` and `spo2` write test records into the
//   watch's HealthKit (Monitor/TestSamples.swift) that reach the trigger through the anchored queries, like real
//   samples; `rhythm` and `fall` report the event directly; `crewHaptic` delivers a test message through the bridge.
// ────────────────────────────────────────────────────────────────────────────────────────────────

/// Thresholds of the automatic triggers. The watch has no `@haven/core` config, so these mirror the unconditional
/// red rules of `packages/core/config/indicators.json` (Orión, P01). Keep them in sync:
///   • `heart-rate`: red `outside: [40, 150]`, «Pulso por encima de 150 o por debajo de 40: comprueba ahora…».
///   • `spo2`: red `outside: [90, 100]`, «Oxígeno por debajo de 90 %: la OMS lo considera una emergencia»
///     (same in every `environmentOverrides` entry).
///   • `heart-rhythm`: red `categories: ['irregular']` (with symptoms). The watch cannot ask for symptoms, so an
///     irregular-rhythm event starts the 15 s countdown and the wearer answers «Estoy bien» or not.
/// The rest are HAVEN design choices (targets/watch/DISENO.md §4, W03).
enum AutoTriggerThresholds {
    /// Heart rate outside this range (bpm), at rest.
    static let heartRateRange: ClosedRange<Double> = 40...150
    /// Consecutive extreme readings needed (one spike is not enough).
    static let heartRateConsecutiveReadings = 2
    /// Two extreme readings further apart than this do not count as consecutive.
    static let heartRateMaxGap: TimeInterval = 10 * 60
    /// SpO₂ below this percentage.
    static let spo2Minimum: Double = 90
    /// Readings older than this are ignored (HealthKit back-fills old samples when the app starts).
    static let maxReadingAge: TimeInterval = 10 * 60
    /// Countdown before an automatic alert is sent (the manual SOS uses 5 s).
    static let countdownSeconds = 15
    /// After «Estoy bien», the same origin stays quiet for this long.
    static let snoozeAfterDismiss: TimeInterval = 10 * 60
    /// After any alert is sent, automatic triggers stay quiet for this long (the workout of the monitor writes
    /// high heart rates into HealthKit that would otherwise re-trigger right after the emergency ends).
    static let quietAfterAlert: TimeInterval = 10 * 60
}

/// Pure evaluation of the readings against `AutoTriggerThresholds` (no clock, no HealthKit).
struct AutoTriggerEvaluator {
    private var heartRateStreak = 0
    private var lastExtremeAt: Date?

    /// True when this reading completes `heartRateConsecutiveReadings` extreme readings at rest.
    mutating func isExtremeHeartRate(_ bpm: Double, takenAt: Date, atRest: Bool, now: Date) -> Bool {
        guard now.timeIntervalSince(takenAt) <= AutoTriggerThresholds.maxReadingAge else { return false }
        guard atRest, !AutoTriggerThresholds.heartRateRange.contains(bpm) else {
            reset()
            return false
        }
        if let lastExtremeAt, takenAt.timeIntervalSince(lastExtremeAt) > AutoTriggerThresholds.heartRateMaxGap {
            heartRateStreak = 0
        }
        heartRateStreak += 1
        lastExtremeAt = takenAt
        return heartRateStreak >= AutoTriggerThresholds.heartRateConsecutiveReadings
    }

    func isLowSpO2(_ percent: Double, takenAt: Date, now: Date) -> Bool {
        now.timeIntervalSince(takenAt) <= AutoTriggerThresholds.maxReadingAge
            && percent < AutoTriggerThresholds.spo2Minimum
    }

    mutating func reset() {
        heartRateStreak = 0
        lastExtremeAt = nil
    }
}

@Observable
@MainActor
final class EmergencyCenter {
    static let shared = EmergencyCenter()

    typealias Origin = EmergencyPayload.Origin

    /// Automatic trigger waiting for confirmation.
    struct PendingTrigger: Identifiable, Equatable {
        let id = UUID()
        let origin: Origin
        let detectedAt: Date
        /// Reading that fired it, e.g. «168 lpm» (nil for rhythm and fall).
        let detail: String?
        /// The same reading as data, sent with the alert (nil for rhythm and fall).
        var reading: TriggerReading? = nil
    }

    /// Value and time of the reading behind an automatic trigger.
    struct TriggerReading: Equatable {
        var heartRate: Double? = nil
        var spo2: Double? = nil
        let takenAt: Date
    }

    /// Last alert sent from this watch. `queued` = the iPhone was not reachable (transferUserInfo).
    struct SentAlert: Equatable, Codable {
        let origin: Origin
        let at: Date
        let queued: Bool
    }

    private(set) var pendingTrigger: PendingTrigger?
    private(set) var lastAlert: SentAlert?
    private(set) var enabledTriggers: Set<Origin>

    @ObservationIgnored private weak var bridge: WatchBridge?
    @ObservationIgnored private var evaluator = AutoTriggerEvaluator()
    @ObservationIgnored private var snoozedUntil: [Origin: Date] = [:]
    @ObservationIgnored private var started = false
    @ObservationIgnored private var queries: [HKQuery] = []
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let log = Logger(subsystem: "app.haven.watch", category: "emergency")

    private static let enabledKey = "haven.emergency.autoTriggers"
    private static let lastAlertKey = "haven.emergency.lastAlert"
    private static let snoozedKey = "haven.emergency.snoozedUntil"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let raw = defaults.stringArray(forKey: Self.enabledKey) {
            enabledTriggers = Set(raw.compactMap(Origin.init(rawValue:))).filter(\.isAvailable)
        } else {
            enabledTriggers = Set(Origin.automatic.filter(\.isAvailable))
        }
        // Castor (QA): the anchored queries back-fill the last `maxReadingAge` on every launch, so the quiet period
        // after an alert and the «Estoy bien» snooze must survive a relaunch, or the same sample fires again.
        if let data = defaults.data(forKey: Self.lastAlertKey) {
            lastAlert = try? JSONDecoder().decode(SentAlert.self, from: data)
        }
        let snoozed = defaults.dictionary(forKey: Self.snoozedKey) as? [String: Double] ?? [:]
        for (raw, until) in snoozed {
            if let origin = Origin(rawValue: raw) { snoozedUntil[origin] = Date(timeIntervalSince1970: until) }
        }
    }

    private func saveLastAlert() {
        if let lastAlert, let data = try? JSONEncoder().encode(lastAlert) {
            defaults.set(data, forKey: Self.lastAlertKey)
        }
    }

    private func saveSnoozes() {
        let active = snoozedUntil.filter { $0.value > .now }
        defaults.set(
            Dictionary(uniqueKeysWithValues: active.map { ($0.key.rawValue, $0.value.timeIntervalSince1970) }),
            forKey: Self.snoozedKey)
    }

    /// Connects the bridge and starts the reading sources. Idempotent.
    func start(bridge: WatchBridge) {
        self.bridge = bridge
        guard !started else { return }
        started = true
        observeHealth()
        #if DEBUG
            runDebugTriggers()
        #endif
    }

    // MARK: Sending

    /// Sends the alert now (manual SOS after its countdown, or a confirmed automatic trigger).
    func send(_ origin: Origin, reading: TriggerReading? = nil) {
        guard let bridge else {
            log.error("send(\(origin.rawValue, privacy: .public)) before start(bridge:)")
            return
        }
        // Castor (QA): an emergency opened another way (phone, self-test) while a countdown ran. startEmergency would
        // do nothing, so recording an alert here would claim one was sent: join the open emergency instead.
        guard !bridge.isEmergencyActive else {
            log.info("Emergency \(origin.rawValue, privacy: .public) joins the one already open: nothing sent")
            return
        }
        lastAlert = SentAlert(origin: origin, at: .now, queued: !bridge.isReachable)
        saveLastAlert()
        log.info("Emergency \(origin.rawValue, privacy: .public) queued=\(!bridge.isReachable)")
        bridge.startEmergency(origin, reading: reading)
    }

    // MARK: Automatic triggers

    func setEnabled(_ origin: Origin, _ isOn: Bool) {
        guard origin.isAvailable else { return }
        if isOn { enabledTriggers.insert(origin) } else { enabledTriggers.remove(origin) }
        defaults.set(enabledTriggers.map(\.rawValue).sorted(), forKey: Self.enabledKey)
    }

    func report(heartRate bpm: Double, takenAt: Date, atRest: Bool) {
        guard isListening(takenAt: takenAt) else { return }
        if evaluator.isExtremeHeartRate(bpm, takenAt: takenAt, atRest: atRest, now: .now) {
            trigger(
                .heartRate, detail: "\(Int(bpm.rounded())) \(L("lpm", "bpm"))",
                reading: TriggerReading(heartRate: bpm.rounded(), takenAt: takenAt))
        }
    }

    func report(spo2 percent: Double, takenAt: Date) {
        guard isListening(takenAt: takenAt) else { return }
        if evaluator.isLowSpO2(percent, takenAt: takenAt, now: .now) {
            trigger(
                .spo2, detail: "SpO₂ \(Int(percent.rounded())) %",
                reading: TriggerReading(spo2: percent.rounded(), takenAt: takenAt))
        }
    }

    func report(irregularRhythmAt date: Date) {
        guard isListening(takenAt: date), Date.now.timeIntervalSince(date) <= AutoTriggerThresholds.maxReadingAge
        else { return }
        trigger(.rhythm, detail: nil)
    }

    /// No product source exists for falls (`Origin.fall.isAvailable == false`): only the DEBUG test calls this, and
    /// it bypasses the (always off) toggle.
    func report(fallAt date: Date) {
        guard isListening(takenAt: date) else { return }
        trigger(.fall, detail: nil, testOnly: true)
    }

    /// «Estoy bien»: nothing is sent and that origin is snoozed.
    func imOK() {
        guard let pending = pendingTrigger else { return }
        log.info("Automatic trigger \(pending.origin.rawValue, privacy: .public) dismissed: nothing sent")
        snoozedUntil[pending.origin] = .now.addingTimeInterval(AutoTriggerThresholds.snoozeAfterDismiss)
        saveSnoozes()
        evaluator.reset()
        pendingTrigger = nil
    }

    /// An emergency started while an automatic countdown was showing: drop the countdown (it joins the emergency,
    /// whose monitor is already open). Nothing is sent and the origin is not snoozed.
    func joinActiveEmergency() {
        guard let pending = pendingTrigger else { return }
        log.info("Automatic trigger \(pending.origin.rawValue, privacy: .public) joins the open emergency")
        evaluator.reset()
        pendingTrigger = nil
    }

    /// The 15 s countdown reached zero: send it.
    func confirmPending() {
        guard let pending = pendingTrigger else { return }
        pendingTrigger = nil
        evaluator.reset()
        // The countdown is a full-screen cover and the monitor (ContentView) is another one: let this one dismiss
        // before `startEmergency` presents the monitor, or SwiftUI drops the second presentation.
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            send(pending.origin, reading: pending.reading)
        }
    }

    /// Readings taken before the last alert, or during its quiet period, are ignored.
    private func isListening(takenAt: Date) -> Bool {
        guard let lastAlert else { return true }
        return takenAt.timeIntervalSince(lastAlert.at) > AutoTriggerThresholds.quietAfterAlert
    }

    private func trigger(_ origin: Origin, detail: String?, reading: TriggerReading? = nil, testOnly: Bool = false) {
        guard testOnly || enabledTriggers.contains(origin) else {
            log.info("Trigger \(origin.rawValue, privacy: .public) is off")
            return
        }
        guard bridge?.isEmergencyActive != true, pendingTrigger == nil else { return }
        if let until = snoozedUntil[origin], until > .now { return }
        log.info("Automatic trigger \(origin.rawValue, privacy: .public): 15 s countdown")
        pendingTrigger = PendingTrigger(origin: origin, detectedAt: .now, detail: detail, reading: reading)
    }

    // MARK: HealthKit (device only)

    private func observeHealth() {
        guard let store = HealthAccess.store else { return }
        // EmergencyCenter is an app-lifetime singleton: the query handlers capture it strongly.
        Task {
            await HealthAccess.requestAuthorization()
            let recent = HKQuery.predicateForSamples(
                withStart: .now.addingTimeInterval(-AutoTriggerThresholds.maxReadingAge), end: nil)
            let types: [HKSampleType] = [
                HealthAccess.heartRateType, HealthAccess.spo2Type, HealthAccess.irregularRhythmType,
            ]
            for type in types {
                let query = HKAnchoredObjectQuery(
                    type: type, predicate: recent, anchor: nil, limit: HKObjectQueryNoLimit
                ) { _, samples, _, _, _ in
                    Task { @MainActor in self.handle(samples ?? []) }
                }
                query.updateHandler = { _, samples, _, _, _ in
                    Task { @MainActor in self.handle(samples ?? []) }
                }
                store.execute(query)
                queries.append(query)
            }
        }
    }

    private func handle(_ samples: [HKSample]) {
        for sample in samples.sorted(by: { $0.endDate < $1.endDate }) {
            if let quantity = sample as? HKQuantitySample {
                if quantity.quantityType == HealthAccess.heartRateType {
                    let context = (quantity.metadata?[HKMetadataKeyHeartRateMotionContext] as? NSNumber)
                        .flatMap { HKHeartRateMotionContext(rawValue: $0.intValue) }
                    report(
                        heartRate: quantity.quantity.doubleValue(for: HealthAccess.bpm),
                        takenAt: quantity.endDate,
                        atRest: context != .active
                    )
                } else if quantity.quantityType == HealthAccess.spo2Type {
                    report(spo2: quantity.quantity.doubleValue(for: .percent()) * 100, takenAt: quantity.endDate)
                }
            } else if sample.sampleType == HealthAccess.irregularRhythmType {
                report(irregularRhythmAt: sample.endDate)
            }
        }
    }

    // MARK: DEBUG test triggers (simulator has no sensors)

    #if DEBUG
        private func runDebugTriggers() {
            let arguments = CommandLine.arguments
            let argument = arguments.firstIndex(of: "-havenTrigger").flatMap {
                arguments.indices.contains($0 + 1) ? arguments[$0 + 1] : nil
            }
            guard let raw = ProcessInfo.processInfo.environment["HAVEN_TRIGGER"] ?? argument else { return }
            let names = raw.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            Task {
                try? await Task.sleep(for: .seconds(4))
                for name in names { await runDebugTrigger(name) }
            }
        }

        private func runDebugTrigger(_ name: String) async {
            log.info("DEBUG trigger: \(name, privacy: .public)")
            switch name {
            case Origin.heartRate.rawValue:
                for _ in 0..<AutoTriggerThresholds.heartRateConsecutiveReadings {
                    await TestSamples.write(heartRate: 168)
                    try? await Task.sleep(for: .seconds(2))
                }
            case Origin.spo2.rawValue:
                await TestSamples.write(spo2: 87)
            case Origin.rhythm.rawValue:
                report(irregularRhythmAt: .now)
            case Origin.fall.rawValue:
                report(fallAt: .now)
            case WatchMessageType.crewHaptic.rawValue:
                guard let bridge else { return }
                let envelope = WatchEnvelope(
                    crewMember: bridge.crewMember, sentAt: ISODate.string(.now),
                    payload: CrewHapticPayload(
                        message: L("Mateo pide ayuda en el módulo 2", "Mateo needs help in module 2"))
                )
                if let data = try? JSONEncoder().encode(envelope), let json = String(data: data, encoding: .utf8) {
                    bridge.receive(json: json, via: "debug")
                }
            case WatchMessageType.emergencyEnd.rawValue:
                // Delivers the phone's «emergency closed» message 20 s later, through the bridge (Rigel's handler).
                try? await Task.sleep(for: .seconds(20))
                guard let bridge else { return }
                let envelope = WatchEnvelope(
                    crewMember: bridge.crewMember, sentAt: ISODate.string(.now),
                    payload: EmergencyEndPayload(endedAt: ISODate.string(.now)))
                if let data = try? JSONEncoder().encode(envelope), let json = String(data: data, encoding: .utf8) {
                    bridge.receive(json: json, via: "debug")
                }
            default:
                log.error("Unknown DEBUG trigger \(name, privacy: .public)")
            }
        }
    #endif
}

// MARK: - Origin texts

extension EmergencyPayload.Origin {
    /// Automatic triggers, in the order they are listed in the settings.
    static let automatic: [Self] = [.heartRate, .spo2, .rhythm, .fall]

    /// Whether the product has a source for it. Fall detection needs an Apple-granted entitlement
    /// (CMFallDetectionManager) HAVEN does not have: the toggle shows «No disponible», off and disabled.
    var isAvailable: Bool { self != .fall }

    /// Countdown title (targets/watch/DISENO.md §4, W03).
    var title: String {
        switch self {
        case .button: L("Enviando aviso", "Sending alert")
        case .fall: L("Caída detectada", "Fall detected")
        case .heartRate: L("Pulso extremo en reposo", "Extreme pulse at rest")
        case .rhythm: L("Ritmo irregular", "Irregular rhythm")
        case .spo2: L("Oxígeno bajo", "Low oxygen")
        }
    }

    /// Short name for the settings toggle.
    var triggerName: String {
        switch self {
        case .button: L("Botón", "Button")
        case .fall: L("Caída", "Fall")
        case .heartRate: L("Pulso extremo", "Extreme pulse")
        case .rhythm: L("Ritmo irregular", "Irregular rhythm")
        case .spo2: L("Oxígeno bajo", "Low oxygen")
        }
    }

    /// What fires it, one grey line under the toggle (values from `AutoTriggerThresholds`).
    var triggerDetail: String {
        let low = Int(AutoTriggerThresholds.heartRateRange.lowerBound)
        let high = Int(AutoTriggerThresholds.heartRateRange.upperBound)
        let minSpO2 = Int(AutoTriggerThresholds.spo2Minimum)
        return switch self {
        case .button: ""
        case .fall: L("No disponible", "Not available")
        case .heartRate:
            L("Menos de \(low) o más de \(high) lpm en reposo", "Below \(low) or above \(high) bpm at rest")
        case .rhythm: L("Cuando el reloj avisa de arritmia", "When the watch flags an arrhythmia")
        case .spo2: L("Último SpO₂ por debajo de \(minSpO2) %", "Latest SpO₂ below \(minSpO2)%")
        }
    }
}
