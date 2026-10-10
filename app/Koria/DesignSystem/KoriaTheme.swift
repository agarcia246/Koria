import SwiftUI

extension Color {
    static let koriaInk = Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
    static let koriaCharcoal = Color(red: 20 / 255, green: 20 / 255, blue: 20 / 255)
    static let koriaIvory = Color(red: 245 / 255, green: 241 / 255, blue: 232 / 255)
    static let koriaPaper = Color(red: 250 / 255, green: 250 / 255, blue: 247 / 255)
    static let koriaSilver = Color(red: 168 / 255, green: 164 / 255, blue: 156 / 255)
    static let koriaWarm = Color(red: 107 / 255, green: 102 / 255, blue: 96 / 255)
    static let koriaChampagne = Color(red: 200 / 255, green: 184 / 255, blue: 138 / 255)
}

struct KoriaPalette {
    var colorScheme: ColorScheme

    var background: Color {
        colorScheme == .dark ? .koriaInk : .koriaPaper
    }

    var surface: Color {
        colorScheme == .dark ? .koriaCharcoal : .koriaIvory
    }

    var elevated: Color {
        colorScheme == .dark ? Color(red: 24 / 255, green: 24 / 255, blue: 24 / 255) : .white
    }

    var foreground: Color {
        colorScheme == .dark ? .koriaIvory : .koriaInk
    }

    var muted: Color {
        colorScheme == .dark ? .koriaSilver : .koriaWarm
    }

    var accent: Color { .koriaChampagne }

    var hairline: Color {
        colorScheme == .dark ? Color.koriaIvory.opacity(0.10) : Color.koriaInk.opacity(0.10)
    }

    var inverse: Color {
        colorScheme == .dark ? .koriaInk : .koriaIvory
    }

    var inverseForeground: Color {
        colorScheme == .dark ? .koriaIvory : .koriaInk
    }
}

private struct KoriaPaletteKey: EnvironmentKey {
    static let defaultValue = KoriaPalette(colorScheme: .light)
}

extension EnvironmentValues {
    var koria: KoriaPalette {
        get { self[KoriaPaletteKey.self] }
        set { self[KoriaPaletteKey.self] = newValue }
    }
}

enum KoriaFont {
    static func display(_ size: CGFloat) -> Font {
        Font.custom("InstrumentSerif-Regular", size: size, relativeTo: .title)
    }

    static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    static func label(_ size: CGFloat = 11) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }
}

enum KoriaSpace {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
    static let hero: CGFloat = 72
}

enum KoriaMotion {
    static let fast: Animation = .easeInOut(duration: 0.20)
    static let standard: Animation = .easeInOut(duration: 0.28)
    static let slow: Animation = .easeInOut(duration: 0.38)

    static func animation(reduceMotion: Bool, _ animation: Animation = standard) -> Animation? {
        reduceMotion ? nil : animation
    }
}

struct KoriaLabelStyle: ViewModifier {
    @Environment(\.koria) private var koria
    var color: Color?

    func body(content: Content) -> some View {
        content
            .font(KoriaFont.label())
            .tracking(2.8)
            .textCase(.uppercase)
            .foregroundStyle(color ?? koria.muted)
    }
}

extension View {
    func koriaLabel(_ color: Color? = nil) -> some View {
        modifier(KoriaLabelStyle(color: color))
    }

    func koriaScreenBackground() -> some View {
        modifier(KoriaScreenBackground())
    }
}

private struct KoriaScreenBackground: ViewModifier {
    @Environment(\.koria) private var koria

    func body(content: Content) -> some View {
        content
            .background(koria.background.ignoresSafeArea())
    }
}
