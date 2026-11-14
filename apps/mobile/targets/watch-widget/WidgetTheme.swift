import SwiftUI
import WidgetKit

enum ComplicationLevel: String {
    case green, amber, red, pending

    var color: Color {
        switch self {
        case .green: WidgetTheme.color(0x30D158)
        case .amber: WidgetTheme.color(0xFF9F0A)
        case .red: WidgetTheme.color(0xFF453A)
        case .pending: WidgetTheme.color(0x8E8E93)
        }
    }

    var symbol: String {
        switch self {
        case .green: "circle.fill"
        case .amber: "circle.lefthalf.filled"
        case .red: "triangle.fill"
        case .pending: "circle.dashed"
        }
    }

    var glyph: String {
        switch self {
        case .green: "●"
        case .amber: "◐"
        case .red: "▲"
        case .pending: "○"
        }
    }

    var meterSegments: Int {
        switch self {
        case .green: 1
        case .amber: 2
        case .red: 3
        case .pending: 0
        }
    }

    func label(_ language: WidgetLanguage) -> String {
        switch self {
        case .green: language.pick("En rango", "In range")
        case .amber: language.pick("Revisar", "Check")
        case .red: language.pick("Emergencia", "Emergency")
        case .pending: language.pick("Pendiente", "Pending")
        }
    }
}

enum WidgetTheme {
    static let foreground = color(0xECECEE)
    static let mutedForeground = color(0x9B9BA3)
    static let tertiary = color(0x80808A)
    static let muted = color(0x1C1C20)
    static let borderStrong = color(0x2F3336)

    static func color(_ hex: UInt32) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

struct WidgetLevelMeter: View {
    let level: ComplicationLevel
    var height: CGFloat = 3

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<3, id: \.self) { index in
                let shape = RoundedRectangle(cornerRadius: height / 2)
                if level == .pending {
                    shape.strokeBorder(WidgetTheme.borderStrong, style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
                } else if index < level.meterSegments {
                    shape.fill(level.color).widgetAccentable()
                } else {
                    shape.fill(WidgetTheme.muted)
                }
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

enum WidgetLanguage: String {
    case es, en

    static var system: WidgetLanguage {
        let code = Locale.preferredLanguages.first.map { Locale(identifier: $0) }?.language.languageCode?.identifier
        return code == "en" ? .en : .es
    }

    var locale: Locale { Locale(identifier: rawValue) }

    func pick(_ es: String, _ en: String) -> String { self == .es ? es : en }
}
