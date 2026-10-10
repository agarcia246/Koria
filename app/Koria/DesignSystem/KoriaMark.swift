import SwiftUI

struct KoriaMark: View {
    var lineWidth: CGFloat = 2.5

    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 40
            var path = Path()
            path.move(to: CGPoint(x: 9 * scale, y: 6 * scale))
            path.addLine(to: CGPoint(x: 9 * scale, y: 34 * scale))
            path.move(to: CGPoint(x: 31 * scale, y: 6 * scale))
            path.addLine(to: CGPoint(x: 31 * scale, y: 34 * scale))
            path.move(to: CGPoint(x: 9 * scale, y: 20 * scale))
            path.addLine(to: CGPoint(x: 35 * scale, y: 20 * scale))
            context.stroke(
                path,
                with: .color(.primary),
                style: StrokeStyle(lineWidth: lineWidth * scale / 2.5, lineCap: .square)
            )
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    KoriaMark()
        .frame(width: 40, height: 40)
        .foregroundStyle(Color.koriaInk)
}
