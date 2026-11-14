import Foundation

// Minimal watch localization (es/en). A helper instead of Localizable.xcstrings: strings live next to the view that
// uses them, like each mobile feature's i18n.ts, and nothing depends on @bacons/apple-targets copying string
// catalogs into the target.
//
// Usage: Text(L("Estado", "Status")). Medical and protocol texts do not go here: they come from the phone.

enum Language: String {
    case es, en

    /// Active language. Defaults to the system one (like mobile: Spanish unless the watch is in English).
    /// The bridge (W00) may set it if the phone shares its preference.
    nonisolated(unsafe) static var current: Language = system

    static var system: Language {
        let preferred = Locale.preferredLanguages.first.map { Locale(identifier: $0) }
        let code = preferred?.language.languageCode?.identifier
        return code == "en" ? .en : .es
    }

    var locale: Locale { Locale(identifier: rawValue) }
}

/// Returns the text in the active language. Named `L` on purpose (short, like `t()` in mobile i18n, uppercase so it
/// does not clash with local `l` variables); do not name a generic parameter `L` in the watch target.
// swift-format-ignore: AlwaysUseLowerCamelCase
func L(_ es: String, _ en: String) -> String {
    Language.current == .es ? es : en
}

// MARK: - Strings shared by several screens

enum Strings {
    static var now: String { L("ahora", "now") }
    static var noData: String { L("sin dato", "no data") }
    static var cancel: String { L("Cancelar", "Cancel") }
    static var send: String { L("Enviar", "Send") }
    static var close: String { L("Cerrar", "Close") }
    static var noIPhone: String { L("Sin conexión con el iPhone", "iPhone not connected") }
    /// «Sin datos recientes»: same visual language as pending (grey, dashed, `clock`).
    static var noRecentData: String { L("Sin datos recientes", "No recent data") }

    /// «hace 5 min», «hace 2 h», «hace 3 d» or «ahora». For the age label on every data point.
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

// Contract dates (ISO 8601) are parsed with the date helper in Contract/Contract.swift (W00).
