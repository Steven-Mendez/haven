#if DEBUG
    import Foundation
    import HealthKit
    import os

    // W04 (Deneb) · DEBUG-only test data: writes records into the watch's HealthKit so the monitor can be tested on
    // the simulator, which has no heart-rate sensor. It is not product logic: the monitor never reads these values
    // directly, it picks them up through its HealthKit anchored queries like any other sample.
    //
    //   SIMCTL_CHILD_HAVEN_TEST_HR_STREAM=1 xcrun simctl launch <watch-udid> app.haven.mobile.watchkitapp
    //
    // While the monitor runs: one heart-rate sample every 5 s (around 112 bpm), plus one SpO₂ sample of 96 % dated
    // 40 min ago when it starts. Release builds do not contain this file.

    enum TestSamples {
        nonisolated(unsafe) private static var stream: Task<Void, Never>?
        private static let log = Logger(subsystem: "app.haven.watch", category: "testSamples")

        static var isRequested: Bool { ProcessInfo.processInfo.environment["HAVEN_TEST_HR_STREAM"] == "1" }

        /// Write access is asked only when a test needs it: the HR stream or the `heartRate`/`spo2` DEBUG triggers
        /// (Emergency/EmergencyCenter.swift).
        static var needsWriteAccess: Bool {
            let trigger = ProcessInfo.processInfo.environment["HAVEN_TRIGGER"] ?? ""
            return isRequested || trigger.contains("heartRate") || trigger.contains("spo2")
        }

        /// One test heart-rate record, now (at rest: no motion context).
        static func write(heartRate bpm: Double) async {
            guard let store = HealthAccess.store else { return }
            await HealthAccess.requestAuthorization()
            await save(
                store, HealthAccess.heartRateType, HKQuantity(unit: HealthAccess.bpm, doubleValue: bpm), at: .now)
        }

        /// One test SpO₂ record (percentage), now.
        static func write(spo2 percent: Double) async {
            guard let store = HealthAccess.store else { return }
            await HealthAccess.requestAuthorization()
            await save(store, HealthAccess.spo2Type, HKQuantity(unit: .percent(), doubleValue: percent / 100), at: .now)
        }

        static func startHeartRateStreamIfRequested() {
            guard isRequested, stream == nil, let store = HealthAccess.store else { return }
            log.info("Writing test samples into HealthKit")
            stream = Task {
                await HealthAccess.requestAuthorization()
                await save(
                    store, HealthAccess.spo2Type, HKQuantity(unit: .percent(), doubleValue: 0.96),
                    at: .now.addingTimeInterval(-40 * 60))
                var bpm = 112.0
                while !Task.isCancelled {
                    bpm = min(max(bpm + Double.random(in: -3...3), 100), 125)
                    await save(
                        store, HealthAccess.heartRateType,
                        HKQuantity(unit: HealthAccess.bpm, doubleValue: bpm.rounded()), at: .now)
                    do { try await Task.sleep(for: .seconds(5)) } catch { return }
                }
            }
        }

        static func stopHeartRateStream() {
            stream?.cancel()
            stream = nil
        }

        private static func save(_ store: HKHealthStore, _ type: HKQuantityType, _ quantity: HKQuantity, at date: Date)
            async
        {
            let sample = HKQuantitySample(type: type, quantity: quantity, start: date, end: date)
            do {
                try await store.save(sample)
            } catch {
                log.error("Test sample not saved: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
#endif
