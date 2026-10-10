import SwiftUI

enum KoriaButtonStyleKind {
    case primary
    case secondary
    case ghost
}

struct KoriaButton: View {
    let title: String
    var style: KoriaButtonStyleKind = .primary
    var isLoading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void

    @Environment(\.koria) private var koria
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            ZStack {
                Text(title)
                    .opacity(isLoading ? 0 : 1)
                if isLoading {
                    ProgressView()
                        .tint(foreground)
                }
            }
            .font(KoriaFont.label(12))
            .tracking(2.4)
            .textCase(.uppercase)
            .foregroundStyle(foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(background)
            .overlay(
                Rectangle()
                    .stroke(border, lineWidth: style == .secondary ? 1 : 0)
            )
        }
        .buttonStyle(KoriaPressStyle(reduceMotion: reduceMotion))
        .disabled(!isEnabled || isLoading)
        .opacity(isEnabled ? 1 : 0.4)
        .accessibilityLabel(title)
    }

    private var background: Color {
        switch style {
        case .primary: koria.foreground
        case .secondary, .ghost: Color.clear
        }
    }

    private var foreground: Color {
        switch style {
        case .primary: koria.inverse
        case .secondary, .ghost: koria.foreground
        }
    }

    private var border: Color {
        style == .secondary ? koria.hairline : .clear
    }
}

private struct KoriaPressStyle: ButtonStyle {
    var reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.985 : 1)
            .opacity(configuration.isPressed ? 0.88 : 1)
            .animation(KoriaMotion.animation(reduceMotion: reduceMotion, KoriaMotion.fast), value: configuration.isPressed)
    }
}

struct KoriaCard<Content: View>: View {
    @Environment(\.koria) private var koria
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(KoriaSpace.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(koria.surface)
    }
}

struct SectionLabel: View {
    let text: String
    var accented: Bool = false
    @Environment(\.koria) private var koria

    var body: some View {
        Text(text)
            .koriaLabel(accented ? koria.accent : koria.muted)
    }
}

struct KoriaDivider: View {
    @Environment(\.koria) private var koria

    var body: some View {
        Rectangle()
            .fill(koria.hairline)
            .frame(height: 1)
    }
}

struct SpecItem: Identifiable, Hashable {
    let id: String
    let label: String
    let value: String
}

struct SpecGrid: View {
    let items: [SpecItem]
    var columns: Int = 2
    @Environment(\.koria) private var koria

    var body: some View {
        let grid = Array(repeating: GridItem(.flexible(), spacing: KoriaSpace.lg), count: columns)
        LazyVGrid(columns: grid, alignment: .leading, spacing: KoriaSpace.lg) {
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.label)
                        .koriaLabel()
                    Text(item.value)
                        .font(KoriaFont.sans(17, weight: .regular))
                        .foregroundStyle(koria.foreground)
                }
            }
        }
    }
}

struct StatusPill: View {
    let text: String
    var tone: Tone = .neutral
    @Environment(\.koria) private var koria

    enum Tone {
        case neutral, accent, live, warning
    }

    var body: some View {
        Text(text)
            .font(KoriaFont.label(10))
            .tracking(1.8)
            .textCase(.uppercase)
            .foregroundStyle(foreground)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .overlay(
                Rectangle()
                    .stroke(foreground.opacity(0.45), lineWidth: 1)
            )
    }

    private var foreground: Color {
        switch tone {
        case .neutral: koria.muted
        case .accent, .live: koria.accent
        case .warning: koria.muted
        }
    }
}

struct PriceLockup: View {
    let offer: PriceOffer
    var compact: Bool = false
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text(offer.mode.label)
                .koriaLabel(offer.mode == .live ? koria.accent : koria.muted)
            if offer.mode != .quoteRequired {
                Text(offer.displayAmount)
                    .font(compact ? KoriaFont.sans(18, weight: .medium) : KoriaFont.display(32))
                    .foregroundStyle(koria.foreground)
                    .monospacedDigit()
            } else {
                Text("On request")
                    .font(compact ? KoriaFont.sans(18, weight: .medium) : KoriaFont.display(28))
                    .foregroundStyle(koria.muted)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(offer.accessibilityLabel)
    }
}

struct AircraftHero: View {
    let category: AircraftCategory
    let title: String
    let subtitle: String
    @Environment(\.koria) private var koria

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            koria.foreground
            AircraftSilhouette(category: category)
                .fill(koria.inverse.opacity(0.12))
                .padding(.horizontal, 28)
                .padding(.bottom, 56)
                .padding(.top, 36)
            VStack(alignment: .leading, spacing: 8) {
                Text(subtitle)
                    .koriaLabel(koria.inverse.opacity(0.55))
                Text(title)
                    .font(KoriaFont.display(34))
                    .foregroundStyle(koria.inverse)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
            .padding(KoriaSpace.lg)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 220)
        .accessibilityElement(children: .combine)
    }
}

struct AircraftSilhouette: Shape {
    var category: AircraftCategory

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        let midY = h * 0.55

        path.move(to: CGPoint(x: w * 0.06, y: midY))
        path.addLine(to: CGPoint(x: w * 0.22, y: midY))
        path.addLine(to: CGPoint(x: w * 0.38, y: midY - h * wingSpan))
        path.addLine(to: CGPoint(x: w * 0.46, y: midY - h * 0.08))
        path.addLine(to: CGPoint(x: w * 0.78, y: midY - h * 0.06))
        path.addQuadCurve(
            to: CGPoint(x: w * 0.94, y: midY),
            control: CGPoint(x: w * 0.92, y: midY - h * 0.10)
        )
        path.addQuadCurve(
            to: CGPoint(x: w * 0.78, y: midY + h * 0.05),
            control: CGPoint(x: w * 0.92, y: midY + h * 0.08)
        )
        path.addLine(to: CGPoint(x: w * 0.50, y: midY + h * 0.06))
        path.addLine(to: CGPoint(x: w * 0.42, y: midY + h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.34, y: midY + h * 0.22))
        path.addLine(to: CGPoint(x: w * 0.40, y: midY + h * 0.06))
        path.addLine(to: CGPoint(x: w * 0.22, y: midY + h * 0.04))
        path.addLine(to: CGPoint(x: w * 0.06, y: midY + h * 0.12))
        path.addLine(to: CGPoint(x: w * 0.08, y: midY + h * 0.04))
        path.closeSubpath()
        return path
    }

    private var wingSpan: CGFloat {
        switch category {
        case .veryLight, .light: 0.18
        case .midsize, .superMidsize: 0.24
        case .heavy, .ultraLongRange: 0.30
        }
    }
}

struct SkeletonBlock: View {
    var height: CGFloat = 16
    @Environment(\.koria) private var koria
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = 0.35

    var body: some View {
        Rectangle()
            .fill(koria.hairline)
            .frame(height: height)
            .opacity(reduceMotion ? 0.7 : phase)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                    phase = 0.85
                }
            }
    }
}

struct EmptyState: View {
    let title: String
    let message: String
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            Text(title)
                .font(KoriaFont.display(36))
                .foregroundStyle(koria.foreground)
            Text(message)
                .font(KoriaFont.sans(16))
                .foregroundStyle(koria.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, KoriaSpace.xl)
    }
}

struct AmenityChip: View {
    let text: String
    @Environment(\.koria) private var koria

    var body: some View {
        Text(text)
            .font(KoriaFont.sans(13))
            .foregroundStyle(koria.foreground)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
    }
}

struct ComposerRow<Value: View>: View {
    let label: String
    @ViewBuilder var value: () -> Value
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(label)
                .koriaLabel()
            value()
            KoriaDivider()
        }
        .padding(.vertical, 6)
    }
}
