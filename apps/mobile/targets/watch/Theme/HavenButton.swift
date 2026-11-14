import SwiftUI

// Watch buttons (SPEC.md §1.2, §4). Usage: `.buttonStyle(.haven(.sos))`.
// Full-width pills of 44 pt (Theme.tapTargetLarge). One primary per screen: the white pill with black text.
// Inside an emergency the main action is `.default` (white), never red; red is only SOS and «Open protocol».

enum HavenButtonVariant {
    /// Primary: white pill, black text (X / Grok). One per screen.
    case `default`
    /// Secondary: `Theme.elevated` fill with a strong hairline («End», «No»). Filled because a hairline alone is too
    /// thin an affordance on the watch.
    case secondary
    /// Red fill: «Open protocol» from a red status. The only red fill besides SOS.
    case destructive
    /// Hairline only: cancel, close.
    case outline
    /// No background: tertiary actions.
    case ghost
    /// SOS pill: red fill, 56 pt (Theme.tapTargetSOS). The SOS page uses the hold ring (`HoldToConfirm`) instead.
    case sos
}

struct HavenButton: ButtonStyle {
    var variant: HavenButtonVariant = .default

    func makeBody(configuration: Configuration) -> some View {
        HavenButtonBody(variant: variant, configuration: configuration)
    }
}

private struct HavenButtonBody: View {
    let variant: HavenButtonVariant
    let configuration: ButtonStyleConfiguration
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        configuration.label
            .font(Typography.button)
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, Spacing.l)
            .padding(.vertical, Spacing.s)
            .frame(maxWidth: .infinity, minHeight: variant == .sos ? Theme.tapTargetSOS : Theme.tapTargetLarge)
            .foregroundStyle(isEnabled ? foreground : Theme.disabled)
            .background(isEnabled ? fill : disabledFill, in: Capsule())
            .overlay {
                if let stroke {
                    Capsule().strokeBorder(stroke, lineWidth: 1)
                }
            }
            .contentShape(Capsule())
            // Round ends off the display corners (Ultra); the tap target stays ≥ 44 pt tall.
            .padding(.horizontal, Theme.capsuleInset)
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(Motion.curve(Motion.micro), value: configuration.isPressed)
    }

    private var fill: Color {
        switch variant {
        case .default: Theme.primary
        case .secondary: Theme.elevated
        case .destructive, .sos: Theme.destructive
        case .outline, .ghost: .clear
        }
    }

    /// Disabled: no white or red fill, so a disabled primary never reads as the action.
    private var disabledFill: Color {
        switch variant {
        case .outline, .ghost: .clear
        default: Theme.muted
        }
    }

    private var stroke: Color? {
        switch variant {
        case .secondary, .outline: Theme.borderStrong
        default: nil
        }
    }

    private var foreground: Color {
        switch variant {
        case .default: Theme.primaryForeground
        case .destructive, .sos: Theme.destructiveForeground
        case .secondary, .outline: Theme.foreground
        case .ghost: Theme.mutedForeground
        }
    }
}

extension ButtonStyle where Self == HavenButton {
    static func haven(_ variant: HavenButtonVariant = .default) -> HavenButton { HavenButton(variant: variant) }
}

#Preview("Buttons") {
    ScrollView {
        VStack(spacing: Spacing.m) {
            Button("SOS") {}.buttonStyle(.haven(.sos))
            Button(Strings.send) {}.buttonStyle(.haven())
            Button("Secondary") {}.buttonStyle(.haven(.secondary))
            Button("Destructive") {}.buttonStyle(.haven(.destructive))
            Button(Strings.cancel) {}.buttonStyle(.haven(.outline))
            Button("Ghost") {}.buttonStyle(.haven(.ghost))
            Button("Disabled") {}.buttonStyle(.haven()).disabled(true)
        }
    }
    .background(Theme.background)
}
