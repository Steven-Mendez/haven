import Foundation
import WidgetKit
import os

// W01 · Data shared with the complication (targets/watch-widget, a separate WidgetKit extension).
// The bridge calls `ComplicationStore.publish(_:)` for every new `status`; it writes a small JSON snapshot to the
// App Group `group.app.haven.mobile` and reloads the complication timelines.
//
// Keep `ComplicationSnapshot` identical to the copy in targets/watch-widget/ComplicationSnapshot.swift: the two
// targets are separate modules and share only these bytes.

/// What the complication shows: the phone's overall level, the next pending measurement and its age.
struct ComplicationSnapshot: Codable, Equatable {
    /// `Level.rawValue`: green · amber · red · pending.
    let overallLevel: String
    let nextPending: String?
    let evaluatedAt: Date
    /// `es` or `en`, from the phone.
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
