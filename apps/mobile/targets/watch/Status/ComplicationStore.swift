import Foundation
import WidgetKit
import os

struct ComplicationSnapshot: Codable, Equatable {
    let overallLevel: String
    let nextPending: String?
    let evaluatedAt: Date
    let language: String?
}

enum ComplicationStore {
    static let appGroup = "group.app.haven.mobile"
    static let key = "haven.complication.snapshot"

    private static let log = Logger(subsystem: "app.haven.watch", category: "complication")

    static func publish(_ status: ReceivedStatus) {
        let snapshot = ComplicationSnapshot(
            overallLevel: status.payload.overallLevel.rawValue,
            nextPending: status.payload.nextPending,
            evaluatedAt: status.evaluatedAt,
            language: status.payload.language
        )
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            log.error("App Group \(appGroup, privacy: .public) not available: complication not updated")
            return
        }
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        if defaults.data(forKey: key) == data { return }
        defaults.set(data, forKey: key)
        WidgetCenter.shared.reloadAllTimelines()
        log.info("Complication updated: \(snapshot.overallLevel, privacy: .public)")
    }
}
