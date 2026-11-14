import Foundation
import HealthKit
import Observation
import os

enum AutoTriggerThresholds {
    static let heartRateRange: ClosedRange<Double> = 40...150
    static let heartRateConsecutiveReadings = 2
    static let heartRateMaxGap: TimeInterval = 10 * 60
    static let spo2Minimum: Double = 90
    static let maxReadingAge: TimeInterval = 10 * 60
    static let countdownSeconds = 15
    static let snoozeAfterDismiss: TimeInterval = 10 * 60
    static let quietAfterAlert: TimeInterval = 10 * 60
}

struct AutoTriggerEvaluator {
    private var heartRateStreak = 0
    private var lastExtremeAt: Date?

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

    struct PendingTrigger: Identifiable, Equatable {
        let id = UUID()
        let origin: Origin
        let detectedAt: Date
        let detail: String?
        var reading: TriggerReading? = nil
    }

    struct TriggerReading: Equatable {
        var heartRate: Double? = nil
        var spo2: Double? = nil
        let takenAt: Date
    }

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

    func start(bridge: WatchBridge) {
        self.bridge = bridge
        guard !started else { return }
        started = true
        observeHealth()
        #if DEBUG
            runDebugTriggers()
        #endif
    }

    func send(_ origin: Origin, reading: TriggerReading? = nil) {
        guard let bridge else {
            log.error("send(\(origin.rawValue, privacy: .public)) before start(bridge:)")
            return
        }
        guard bridge.missionSession == .active else {
            log.info("Emergency \(origin.rawValue, privacy: .public) ignored: no active mission session")
            return
        }
        guard !bridge.isEmergencyActive else {
            log.info("Emergency \(origin.rawValue, privacy: .public) joins the one already open: nothing sent")
            return
        }
        lastAlert = SentAlert(origin: origin, at: .now, queued: !bridge.isReachable)
        saveLastAlert()
        log.info("Emergency \(origin.rawValue, privacy: .public) queued=\(!bridge.isReachable)")
        bridge.startEmergency(origin, reading: reading)
    }

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

    func report(fallAt date: Date) {
        guard isListening(takenAt: date) else { return }
        trigger(.fall, detail: nil, testOnly: true)
    }

    func imOK() {
        guard let pending = pendingTrigger else { return }
        log.info("Automatic trigger \(pending.origin.rawValue, privacy: .public) dismissed: nothing sent")
        snoozedUntil[pending.origin] = .now.addingTimeInterval(AutoTriggerThresholds.snoozeAfterDismiss)
        saveSnoozes()
        evaluator.reset()
        pendingTrigger = nil
    }

    func joinActiveEmergency() {
        guard let pending = pendingTrigger else { return }
        log.info("Automatic trigger \(pending.origin.rawValue, privacy: .public) joins the open emergency")
        evaluator.reset()
        pendingTrigger = nil
    }

    func confirmPending() {
        guard let pending = pendingTrigger else { return }
        pendingTrigger = nil
        evaluator.reset()
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            send(pending.origin, reading: pending.reading)
        }
    }

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
        guard testOnly || bridge?.missionSession == .active else { return }
        if let until = snoozedUntil[origin], until > .now { return }
        log.info("Automatic trigger \(origin.rawValue, privacy: .public): 15 s countdown")
        pendingTrigger = PendingTrigger(origin: origin, detectedAt: .now, detail: detail, reading: reading)
    }

    private func observeHealth() {
        guard let store = HealthAccess.store else { return }
        Task {
            await HealthAccess.requestAuthorization()
            let recent = HKQuery.predicateForSamples(
                withStart: .now.addingTimeInterval(-AutoTriggerThresholds.maxReadingAge), end: nil)
            let types: [HKSampleType] = [HealthAccess.heartRateType, HealthAccess.spo2Type]
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

extension EmergencyPayload.Origin {
    static let automatic: [Self] = [.heartRate, .spo2, .fall]

    var isAvailable: Bool { self != .fall && self != .rhythm }

    var title: String {
        switch self {
        case .button: L("Enviando aviso", "Sending alert")
        case .fall: L("Caída detectada", "Fall detected")
        case .heartRate: L("Pulso extremo en reposo", "Extreme pulse at rest")
        case .rhythm: L("Ritmo irregular", "Irregular rhythm")
        case .spo2: L("Oxígeno bajo", "Low oxygen")
        }
    }

    var triggerName: String {
        switch self {
        case .button: L("Botón", "Button")
        case .fall: L("Caída", "Fall")
        case .heartRate: L("Pulso extremo", "Extreme pulse")
        case .rhythm: L("Ritmo irregular", "Irregular rhythm")
        case .spo2: L("Oxígeno bajo", "Low oxygen")
        }
    }

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
