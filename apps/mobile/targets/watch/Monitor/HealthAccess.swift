import Foundation
import HealthKit
import os

enum HealthAccess {
    static let store: HKHealthStore? = HKHealthStore.isHealthDataAvailable() ? HKHealthStore() : nil

    static let heartRateType = HKQuantityType(.heartRate)
    static let spo2Type = HKQuantityType(.oxygenSaturation)
    static let irregularRhythmType = HKCategoryType(.irregularHeartRhythmEvent)

    static let bpm = HKUnit.count().unitDivided(by: .minute())

    private static let log = Logger(subsystem: "app.haven.watch", category: "health")
    nonisolated(unsafe) private static var requested = false

    static func requestAuthorization() async {
        guard let store, !requested else { return }
        requested = true
        var share: Set<HKSampleType> = [HKObjectType.workoutType()]
        #if DEBUG
            if TestSamples.needsWriteAccess { share.formUnion([heartRateType, spo2Type]) }
        #endif
        do {
            try await store.requestAuthorization(
                toShare: share,
                read: [heartRateType, spo2Type, irregularRhythmType]
            )
        } catch {
            log.error("HealthKit authorization failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    static func latestSpO2() async -> (value: Double, takenAt: Date)? {
        guard let store else { return nil }
        let sample: HKQuantitySample? = await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: spo2Type,
                predicate: nil,
                limit: 1,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            ) { _, samples, _ in
                continuation.resume(returning: samples?.first as? HKQuantitySample)
            }
            store.execute(query)
        }
        guard let sample else { return nil }
        return (sample.quantity.doubleValue(for: .percent()) * 100, sample.endDate)
    }
}
