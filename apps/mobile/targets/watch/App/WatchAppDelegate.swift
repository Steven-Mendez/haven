import HealthKit
import WatchKit
import os

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
