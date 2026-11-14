import HealthKit
import WatchKit
import os

/// App delegate of the watch app. It owns the single `WatchBridge` (HavenWatchApp puts it in the environment) so
/// system entry points that arrive outside SwiftUI can reach it.
///
/// Phone-initiated emergency (W04): when the emergency starts on the iPhone (SOS button or a red status), the phone
/// calls `HKHealthStore().startWatchApp(with:)` (HavenWatch module, `startWatchMonitor()`). watchOS launches or
/// wakes this app and calls `handle(_ workoutConfiguration:)`; we open the patient monitor without sending an
/// `emergency` back (the phone already has it). PatientMonitor (Monitor/) starts its own workout session.
final class WatchAppDelegate: NSObject, WKApplicationDelegate {
    let bridge = WatchBridge()
    private let log = Logger(subsystem: "app.haven.watch", category: "bridge")

    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        log.info("startWatchApp from the iPhone: opening the patient monitor")
        DispatchQueue.main.async {
            self.bridge.startEmergency(nil, notifyPhone: false)
        }
    }
}
