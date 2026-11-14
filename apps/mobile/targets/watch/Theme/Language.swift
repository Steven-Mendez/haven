import Foundation

enum Language: String {
    case es, en

    nonisolated(unsafe) static var current: Language = system

    static var system: Language {
        let preferred = Locale.preferredLanguages.first.map { Locale(identifier: $0) }
        let code = preferred?.language.languageCode?.identifier
        return code == "en" ? .en : .es
    }

    var locale: Locale { Locale(identifier: rawValue) }
}

// swift-format-ignore: AlwaysUseLowerCamelCase
func L(_ es: String, _ en: String) -> String {
    Language.current == .es ? es : en
}

enum Strings {
    static var now: String { L("ahora", "now") }
    static var noData: String { L("sin dato", "no data") }
    static var cancel: String { L("Cancelar", "Cancel") }
    static var send: String { L("Enviar", "Send") }
    static var close: String { L("Cerrar", "Close") }
    static var noIPhone: String { L("Sin conexión con el iPhone", "iPhone not connected") }
    static var noRecentData: String { L("Sin datos recientes", "No recent data") }

    static func ago(_ date: Date, now: Date = .now) -> String {
        let seconds = max(0, now.timeIntervalSince(date))
        let minutes = Int(seconds / 60)
        if minutes < 1 { return Strings.now }
        if minutes < 60 { return L("hace \(minutes) min", "\(minutes) min ago") }
        let hours = minutes / 60
        if hours < 24 { return L("hace \(hours) h", "\(hours) h ago") }
        return L("hace \(hours / 24) d", "\(hours / 24) d ago")
    }
}
