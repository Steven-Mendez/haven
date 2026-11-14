import Foundation
import HealthKit
import os

// W03/W04 (Deneb) · HealthKit access shared by the patient monitor (workout session, latest SpO₂) and the automatic
// emergency triggers (heart rate, SpO₂, irregular rhythm). Authorization is asked once, the first time either needs
// it. Same code on the simulator: it has no sensor, so test records are written into its HealthKit (DEBUG only).

enum HealthAccess {
    static let store: HKHealthStore? = HKHealthStore.isHealthDataAvailable() ? HKHealthStore() : nil

    static let heartRateType = HKQuantityType(.heartRate)
    static let spo2Type = HKQuantityType(.oxygenSaturation)
    static let irregularRhythmType = HKCategoryType(.irregularHeartRhythmEvent)

    static let bpm = HKUnit.count().unitDivided(by: .minute())

    private static let log = Logger(subsystem: "app.haven.watch", category: "health")
    nonisolated(unsafe) private static var requested = false

    /// Read heart rate, SpO₂ and irregular-rhythm events; share workouts (W04 session). Safe to call many times.
    static func requestAuthorization() async {
        guard let store, !requested else { return }
        requested = true
        var share: Set<HKSampleType> = [HKObjectType.workoutType()]
        #if DEBUG
            // Test data only (Monitor/TestSamples.swift writes heart-rate and SpO₂ records on the simulator).
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

    /// Latest SpO₂ sample, as a percentage (HealthKit stores a 0…1 fraction) and its date.
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
