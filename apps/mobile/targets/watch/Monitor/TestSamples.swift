#if DEBUG
    import Foundation
    import HealthKit
    import os

    enum TestSamples {
        nonisolated(unsafe) private static var stream: Task<Void, Never>?
        private static let log = Logger(subsystem: "app.haven.watch", category: "testSamples")

        static var isRequested: Bool { ProcessInfo.processInfo.environment["HAVEN_TEST_HR_STREAM"] == "1" }

        static var needsWriteAccess: Bool {
            let trigger = ProcessInfo.processInfo.environment["HAVEN_TRIGGER"] ?? ""
            return isRequested || trigger.contains("heartRate") || trigger.contains("spo2")
        }

        static func write(heartRate bpm: Double) async {
            guard let store = HealthAccess.store else { return }
            await HealthAccess.requestAuthorization()
            await save(
                store, HealthAccess.heartRateType, HKQuantity(unit: HealthAccess.bpm, doubleValue: bpm), at: .now)
        }

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
