import SwiftUI

enum Theme {
    static let background = Color(hex: 0x000000)
    static let card = Color(hex: 0x0F0F11)
    static let elevated = Color(hex: 0x16161A)
    static let muted = Color(hex: 0x1C1C20)
    static let secondary = elevated

    static let borderSubtle = Color(hex: 0x16161A)
    static let border = Color(hex: 0x232327)
    static let borderStrong = Color(hex: 0x2F3336)
    static let input = borderStrong

    static let foreground = Color(hex: 0xECECEE)
    static let mutedForeground = Color(hex: 0x9B9BA3)
    static let tertiary = Color(hex: 0x80808A)
    static let disabled = Color(hex: 0x45454C)

    static let primary = Color(hex: 0xF4F4F5)
    static let primaryForeground = Color(hex: 0x000000)
    static let accent = Color(hex: 0x0A84FF)
    static let accentSubtle = Color(hex: 0x0A84FF).opacity(0.14)
    static let accentForeground = Color(hex: 0x000000)
    static let ring = accent
    static let destructive = Color(hex: 0xFF453A)
    static let destructiveForeground = Color(hex: 0xFFFFFF)

    static let green = Color(hex: 0x30D158)
    static let amber = Color(hex: 0xFF9F0A)
    static let red = Color(hex: 0xFF453A)
    static let pending = Color(hex: 0x8E8E93)

    static let greenBackground = green.opacity(0.12)
    static let amberBackground = amber.opacity(0.12)
    static let redBackground = red.opacity(0.12)
    static let greenBorder = green.opacity(0.24)
    static let amberBorder = amber.opacity(0.24)
    static let redBorder = red.opacity(0.24)
    static let pendingBorder = borderStrong

    static let ring1 = Color(hex: 0x4FD2EC)
    static let ring2 = Color(hex: 0x6B93FF)
    static let ring3 = Color(hex: 0xB88CFF)
    static let ringTrackOpacity: Double = 0.2

    static let radiusSmall: CGFloat = 6
    static let radius: CGFloat = 12

    static let tapTarget: CGFloat = 44
    static let tapTargetLarge: CGFloat = 44
    static let tapTargetSOS: CGFloat = 56
    static let ringWidth: CGFloat = 6
    static let holdRingWidth: CGFloat = 8
    static let meterHeight: CGFloat = 4

    static let screenMargin: CGFloat = Spacing.m
    static let cornerInset: CGFloat = 24
    static let foldGap: CGFloat = 40
    static let capsuleInset: CGFloat = Spacing.s
}

enum Spacing {
    static let xs: CGFloat = 2
    static let s: CGFloat = 4
    static let m: CGFloat = 8
    static let l: CGFloat = 12
    static let xl: CGFloat = 16
    static let xxl: CGFloat = 24
}

enum Typography {
    static let micro = Font.footnote.weight(.medium).monospacedDigit()
    static let caption = Font.footnote.monospacedDigit()
    static let label = Font.footnote.monospacedDigit()
    static let bodySmall = Font.caption2.monospacedDigit()
    static let body = Font.body.monospacedDigit()
    static let button = Font.headline.monospacedDigit()
    static let titleSmall = Font.headline.monospacedDigit()
    static let title = Font.title3.weight(.semibold).monospacedDigit()
    static let display = Font.title2.weight(.semibold).monospacedDigit()
    static let metric = Font.system(size: 40, weight: .semibold).monospacedDigit()
    static let metricXL = Font.system(size: 56, weight: .semibold).monospacedDigit()
    static let mono = Font.system(size: 12, weight: .medium, design: .monospaced)
    static let figure = metricXL
    static let figureMedium = metric
}

enum Motion {
    static let micro: Double = 0.1
    static let standard: Double = 0.16
    static let enter: Double = 0.24
    static let figure: Double = 0.4
    static let press: Double = micro
    static let expand: Double = enter

    static func curve(_ duration: Double = standard) -> Animation {
        .timingCurve(0.16, 1, 0.3, 1, duration: duration)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
