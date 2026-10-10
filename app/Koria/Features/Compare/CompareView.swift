import SwiftUI

struct CompareView: View {
    @Environment(\.koria) private var koria
    @Environment(SearchViewModel.self) private var model

    var body: some View {
        let items = model.compareResults
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                Text("Two options.\nClear tradeoffs.")
                    .font(KoriaFont.display(40))
                    .foregroundStyle(koria.foreground)
                    .padding(.top, KoriaSpace.sm)

                if items.count == 2 {
                    HStack(alignment: .top, spacing: KoriaSpace.sm) {
                        CompareColumn(result: items[0]) {
                            model.path.append(SearchRoute.request(items[0].id))
                        }
                        CompareColumn(result: items[1]) {
                            model.path.append(SearchRoute.request(items[1].id))
                        }
                    }
                } else {
                    EmptyState(
                        title: "Select two aircraft.",
                        message: "Return to results and mark a pair to compare."
                    )
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Compare")
                    .koriaLabel()
            }
        }
    }
}

private struct CompareColumn: View {
    let result: SearchResult
    var request: () -> Void
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            Text(result.listing.model.name)
                .font(KoriaFont.display(26))
                .foregroundStyle(koria.foreground)
                .minimumScaleFactor(0.8)
                .lineLimit(2)
            Text(result.listing.operatorProfile.name)
                .koriaLabel()
            PriceLockup(offer: result.price, compact: true)
            VStack(alignment: .leading, spacing: 12) {
                row("Category", result.listing.model.category.displayName)
                row("Seats", "\(result.listing.aircraft.seating)")
                row("Range", "\(result.listing.model.rangeNM) nm")
                row("Cruise", "\(result.listing.model.cruiseSpeedKTAS) ktas")
                row("Cabin", String(format: "%.0f ft", result.listing.model.cabinLengthFt))
                row("Wi‑Fi", (result.listing.aircraft.wifi ?? result.listing.amenities.contains(where: { $0.kind == .wifi })) ? "Yes" : "No")
            }
            Text(result.tradeoff)
                .font(KoriaFont.sans(13))
                .foregroundStyle(koria.muted)
                .fixedSize(horizontal: false, vertical: true)
            Button("Request", action: request)
                .font(KoriaFont.label(11))
                .tracking(1.6)
                .textCase(.uppercase)
                .foregroundStyle(koria.foreground)
                .padding(.top, 4)
        }
        .padding(KoriaSpace.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(koria.surface)
    }

    private func row(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).koriaLabel()
            Text(value)
                .font(KoriaFont.sans(13))
                .foregroundStyle(koria.foreground)
        }
    }
}
