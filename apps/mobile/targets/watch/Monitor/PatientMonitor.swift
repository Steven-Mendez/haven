import Foundation
import HealthKit
import Observation
import os

// W04 (Deneb) · Patient monitor engine: heart rate + latest SpO₂ from HealthKit, sent to the phone with
// `bridge.sendMonitor(heartRate:spo2:spo2TakenAt:)` while the emergency lasts.
//
// Heart rate, two real sources (whichever sample is newer wins):
//   • `HKWorkoutSession` + `HKLiveWorkoutBuilder`: the only way an app gets high-frequency heart rate on watchOS.
//     While it delivers data the UI says «En vivo». The workout is discarded when the monitor stops.
//   • An anchored query on HealthKit heart-rate samples (latest sample and every new one), for when the session
//     gives nothing (no permission, or no sensor). The UI then shows the sample's age instead of «En vivo».
// SpO₂: no app can request a measurement, so it is the latest HealthKit sample (anchored query, kept up to date).
// Nothing is generated here. On the simulator there is no sensor: write test samples into the watch's HealthKit
// (DEBUG `SIMCTL_CHILD_HAVEN_TEST_HR_STREAM=1`, Monitor/TestSamples.swift) and the anchored queries pick them up like
// any other sample.
//
// Sending: every `sendInterval` the newest heart-rate sample is sent if it is new (each sample once) and not older
// than `maxHeartRateAge`. Haptics: `bridge.mutesHaptics = true` while running (the haptic engine interrupts
// heart-rate readings); `bridge.endEmergency()` turns them back on.
//
// Lifecycle (the session lives here, not in the bridge: only the monitor uses it): MonitorView calls `start` when it
// appears and `stop` when it disappears or the emergency ends.

@Observable
@MainActor
final class PatientMonitor: NSObject {
    /// How often the newest sample is checked and sent to the phone.
    static let sendInterval: Duration = .seconds(5)
    /// A heart-rate sample older than this is not sent (the sensor lost contact).
    static let maxHeartRateAge: TimeInterval = 2 * 60
    /// The workout counts as «live» while it delivered a value within this time.
    static let liveWindow: TimeInterval = 15

    private(set) var heartRate: Double?
    private(set) var heartRateAt: Date?
    /// Last time the workout session delivered heart rate.
    private(set) var liveAt: Date?
    private(set) var spo2: Double?
    private(set) var spo2At: Date?
    private(set) var lastSentAt: Date?
    private(set) var isRunning = false
    /// HealthKit is not available or the workout session could not start.
    private(set) var sessionUnavailable = false

    var isLive: Bool { liveAt.map { Date.now.timeIntervalSince($0) <= Self.liveWindow } ?? false }

    @ObservationIgnored private weak var bridge: WatchBridge?
    @ObservationIgnored private var loops: [Task<Void, Never>] = []
    @ObservationIgnored private var queries: [HKQuery] = []
    @ObservationIgnored private var session: HKWorkoutSession?
    @ObservationIgnored private var builder: HKLiveWorkoutBuilder?
    @ObservationIgnored private var lastSentSampleAt: Date?
    @ObservationIgnored private let log = Logger(subsystem: "app.haven.watch", category: "monitor")

    func start(bridge: WatchBridge) {
        guard !isRunning else { return }
        isRunning = true
        self.bridge = bridge
        bridge.mutesHaptics = true
        log.info("Monitor started")
        loops.append(
            Task {
                await HealthAccess.requestAuthorization()
                guard isRunning else { return }
                observeSamples()
                await startWorkout()
            })
        loops.append(Task { await sendLoop() })
        #if DEBUG
            TestSamples.startHeartRateStreamIfRequested()
        #endif
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        for loop in loops { loop.cancel() }
        loops.removeAll()
        if let store = HealthAccess.store {
            for query in queries { store.stop(query) }
        }
        queries.removeAll()
        endWorkout()
        #if DEBUG
            TestSamples.stopHeartRateStream()
        #endif
        log.info("Monitor stopped")
    }

    // MARK: Sending

    private func sendLoop() async {
        while !Task.isCancelled {
            sendLatest()
            do { try await Task.sleep(for: Self.sendInterval) } catch { return }
        }
    }

    private func sendLatest() {
        guard let bridge, bridge.isEmergencyActive, let heartRate, let heartRateAt,
            heartRateAt != lastSentSampleAt,
            Date.now.timeIntervalSince(heartRateAt) <= Self.maxHeartRateAge
        else { return }
        bridge.sendMonitor(heartRate: heartRate.rounded(), spo2: spo2, spo2TakenAt: spo2At, takenAt: heartRateAt)
        lastSentSampleAt = heartRateAt
        lastSentAt = .now
    }

    private func receive(heartRate bpm: Double, at date: Date, live: Bool) {
        if live { liveAt = .now }
        if let heartRateAt, date < heartRateAt { return }
        heartRate = bpm
        heartRateAt = date
    }

    private func receive(spo2 percent: Double, at date: Date) {
        if let spo2At, date < spo2At { return }
        spo2 = percent
        spo2At = date
    }

    // MARK: HealthKit samples (anchored queries)

    private func observeSamples() {
        guard let store = HealthAccess.store else {
            sessionUnavailable = true
            return
        }
        // Latest sample of each type (limit 1, newest first), then every new one through an anchored query.
        for type in [HealthAccess.heartRateType, HealthAccess.spo2Type] {
            let latest = HKSampleQuery(
                sampleType: type, predicate: nil, limit: 1,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            ) { [weak self] _, samples, _ in
                let samples = samples ?? []
                Task { @MainActor in self?.handle(samples) }
            }
            let updates = HKAnchoredObjectQuery(
                type: type, predicate: HKQuery.predicateForSamples(withStart: .now, end: nil), anchor: nil,
                limit: HKObjectQueryNoLimit
            ) { [weak self] _, samples, _, _, _ in
                let samples = samples ?? []
                Task { @MainActor in self?.handle(samples) }
            }
            updates.updateHandler = { [weak self] _, samples, _, _, _ in
                let samples = samples ?? []
                Task { @MainActor in self?.handle(samples) }
            }
            store.execute(latest)
            store.execute(updates)
            queries.append(updates)
        }
    }

    private func handle(_ samples: [HKSample]) {
        guard isRunning else { return }
        for case let sample as HKQuantitySample in samples {
            if sample.quantityType == HealthAccess.heartRateType {
                receive(heartRate: sample.quantity.doubleValue(for: HealthAccess.bpm), at: sample.endDate, live: false)
            } else if sample.quantityType == HealthAccess.spo2Type {
                receive(spo2: sample.quantity.doubleValue(for: .percent()) * 100, at: sample.endDate)
            }
        }
    }

    // MARK: Workout session

    private func startWorkout() async {
        guard let store = HealthAccess.store else {
            sessionUnavailable = true
            return
        }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .other
        configuration.locationType = .indoor
        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: configuration)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: configuration)
            builder.delegate = self
            self.session = session
            self.builder = builder
            let start = Date.now
            session.startActivity(with: start)
            try await builder.beginCollection(at: start)
            log.info("Workout session running")
        } catch {
            sessionUnavailable = true
            log.error("Workout session failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func endWorkout() {
        guard let session, let builder else { return }
        session.end()
        builder.endCollection(withEnd: .now) { _, _ in builder.discardWorkout() }
        self.session = nil
        self.builder = nil
    }
}

extension PatientMonitor: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        guard collectedTypes.contains(HealthAccess.heartRateType),
            let statistics = workoutBuilder.statistics(for: HealthAccess.heartRateType),
            let quantity = statistics.mostRecentQuantity()
        else { return }
        let bpm = quantity.doubleValue(for: HealthAccess.bpm)
        let date = statistics.mostRecentQuantityDateInterval()?.end ?? .now
        Task { @MainActor in self.receive(heartRate: bpm, at: date, live: true) }
    }
}
