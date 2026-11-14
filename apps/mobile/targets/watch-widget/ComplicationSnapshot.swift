import Foundation

struct ComplicationSnapshot: Codable, Equatable {
    let overallLevel: String
    let nextPending: String?
    let evaluatedAt: Date
    let language: String?

    static let appGroup = "group.app.haven.mobile"
    static let key = "haven.complication.snapshot"
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
