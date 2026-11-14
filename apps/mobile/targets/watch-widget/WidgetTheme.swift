import SwiftUI
import WidgetKit

// Minimal copy of targets/watch/Theme for the complication (level colors, symbols, labels and texts).
//
// Why a copy and not the Theme files themselves: @bacons/apple-targets 5 only shares sources through `_shared/`
// folders (`targets/<target>/_shared/*` and `targets/_shared/*`), and both also add the files to the **iPhone**
// app target. Theme/ imports WatchKit (Countdown) and depends on `Level` from Contract/, so it cannot compile there.
// Keep these values in sync with Theme/Theme.swift and Theme/Level.swift (source: haven/design/redesign/SPEC.md).

/// Level as sent by the phone (`Level` in Contract.swift).
enum ComplicationLevel: String {
    case green, amber, red, pending

    /// `Theme.green` … `Theme.pending` (SPEC §2 «Niveles», dark; Apple system colours since v3.1).
    var color: Color {
        switch self {
        case .green: WidgetTheme.color(0x30D158)
        case .amber: WidgetTheme.color(0xFF9F0A)
        case .red: WidgetTheme.color(0xFF453A)
        case .pending: WidgetTheme.color(0x8E8E93)
        }
    }

    /// Same SF Symbols as `Level.symbol`: ● ◐ ▲ ○ (dashed).
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

    /// Same as `Level.meterSegments`: lit segments of the 3-segment meter.
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

/// `Theme` subset: text and track colours.
enum WidgetTheme {
    static let foreground = color(0xECECEE)  // Theme.foreground
    static let mutedForeground = color(0x9B9BA3)  // Theme.mutedForeground
    static let tertiary = color(0x80808A)  // Theme.tertiary (SPEC v3.1)
    static let muted = color(0x1C1C20)  // Theme.muted (meter track)
    static let borderStrong = color(0x2F3336)  // Theme.borderStrong (pending dashes)

    static func color(_ hex: UInt32) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// `LevelMeter` of the watch app, for the rectangular complication. Lit segments are `.widgetAccentable()` so they
/// survive tinted faces; pending dashes all three.
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

/// `Language` of the watch app, resolved from the snapshot (the phone's language) or the system.
enum WidgetLanguage: String {
    case es, en

    static var system: WidgetLanguage {
        let code = Locale.preferredLanguages.first.map { Locale(identifier: $0) }?.language.languageCode?.identifier
        return code == "en" ? .en : .es
    }

    var locale: Locale { Locale(identifier: rawValue) }

    func pick(_ es: String, _ en: String) -> String { self == .es ? es : en }
}
