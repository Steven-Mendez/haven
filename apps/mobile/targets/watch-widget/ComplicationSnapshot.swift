import Foundation

// Copy of `ComplicationSnapshot` in targets/watch/Status/ComplicationStore.swift: keep both identical.
// The watch app writes it as JSON under `key` in the App Group; this extension only reads it.

struct ComplicationSnapshot: Codable, Equatable {
    /// green · amber · red · pending.
    let overallLevel: String
    let nextPending: String?
    let evaluatedAt: Date
    /// `es` or `en`, from the phone.
    let language: String?

    static let appGroup = "group.app.haven.mobile"
    static let key = "haven.complication.snapshot"
    /// Past this age the complication adds a `clock` (same rule as `AgeLabel(staleAfterMin: 60)`).
    static let staleAfter: TimeInterval = 60 * 60

    static func load() -> ComplicationSnapshot? {
        guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ComplicationSnapshot.self, from: data)
    }

    var level: ComplicationLevel { ComplicationLevel(rawValue: overallLevel) ?? .pending }
    var widgetLanguage: WidgetLanguage { language.flatMap(WidgetLanguage.init(rawValue:)) ?? .system }

    func isStale(at date: Date) -> Bool { date.timeIntervalSince(evaluatedAt) > Self.staleAfter }

    static let placeholder = ComplicationSnapshot(
        overallLevel: "amber", nextPending: nil, evaluatedAt: .now, language: nil)
}
