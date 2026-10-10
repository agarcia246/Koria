import SwiftUI

struct SearchResultsView: View {
    @Environment(\.koria) private var koria
    @Environment(SearchViewModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                header
                if model.isSearching {
                    VStack(spacing: KoriaSpace.md) {
                        SkeletonBlock(height: 180)
                        SkeletonBlock(height: 180)
                    }
                } else if model.results.isEmpty {
                    EmptyState(
                        title: "No aircraft for this trip.",
                        message: "Try another date, fewer passengers, or a closer city pair. Range and cabin size have to match the mission."
                    )
                } else {
                    ForEach(model.results) { result in
                        SearchResultCard(
                            result: result,
                            isCompared: model.isCompared(result.id),
                            onOpen: { model.path.append(SearchRoute.aircraft(result.id)) },
                            onCompare: { model.toggleCompare(result.id) },
                            onRequest: { model.path.append(SearchRoute.request(result.id)) }
                        )
                    }
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Options")
                    .koriaLabel()
            }
            if model.compareIDs.count == 2 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Compare") {
                        model.path.append(SearchRoute.compare)
                    }
                    .font(KoriaFont.label(12))
                    .foregroundStyle(koria.accent)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if model.compareIDs.count == 2 {
                KoriaButton(title: "Compare selected") {
                    model.path.append(SearchRoute.compare)
                }
                .padding(.horizontal, KoriaSpace.lg)
                .padding(.vertical, KoriaSpace.sm)
                .background(koria.background)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let origin = model.origin, let destination = model.destination {
                Text("\(origin.city) → \(destination.city)")
                    .font(KoriaFont.display(40))
                    .foregroundStyle(koria.foreground)
                Text("\(model.departureDate.koriaDateTime)  ·  \(model.passengers) pax")
                    .font(KoriaFont.sans(15))
                    .foregroundStyle(koria.muted)
            }
            Text("KORIA curated a small set. Not a dump of every tail.")
                .font(KoriaFont.sans(14))
                .foregroundStyle(koria.muted)
                .padding(.top, 4)
        }
        .padding(.top, KoriaSpace.sm)
    }
}

struct SearchResultCard: View {
    let result: SearchResult
    var isCompared: Bool
    var onOpen: () -> Void
    var onCompare: () -> Void
    var onRequest: () -> Void
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 0) {
                    AircraftHero(
                        category: result.listing.model.category,
                        title: result.listing.model.name,
                        subtitle: result.listing.model.category.displayName
                    )
                    VStack(alignment: .leading, spacing: KoriaSpace.md) {
                        if !result.rankTags.isEmpty {
                            HStack(spacing: 8) {
                                ForEach(result.rankTags, id: \.self) { tag in
                                    StatusPill(text: tag, tone: .accent)
                                }
                            }
                        }
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("\(result.origin.iata) → \(result.destination.iata)  ·  \(result.passengers) pax")
                                    .font(KoriaFont.sans(14))
                                    .foregroundStyle(koria.muted)
                                amenityChecks
                            }
                            Spacer(minLength: 16)
                            PriceLockup(offer: result.price, compact: true)
                        }
                    }
                    .padding(KoriaSpace.lg)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(result.listing.model.displayName), \(result.listing.model.category.displayName). \(result.price.accessibilityLabel).")
            KoriaDivider()
            HStack {
                Button(action: onCompare) {
                    Text(isCompared ? "Selected for compare" : "Select to compare")
                        .koriaLabel(isCompared ? koria.accent : koria.muted)
                }
                .accessibilityAddTraits(isCompared ? .isSelected : [])
                Spacer()
                Button(action: onRequest) {
                    Text("Request trip")
                        .koriaLabel(koria.accent)
                }
            }
            .padding(KoriaSpace.lg)
        }
        .background(koria.surface)
    }

    private var amenityChecks: some View {
        let plane = result.listing.aircraft
        let checks: [(String, Bool)] = [
            ("Wi‑Fi", plane.wifi ?? result.listing.amenities.contains(where: { $0.kind == .wifi })),
            ("Pets", plane.pets ?? result.listing.amenities.contains(where: { $0.kind == .pets })),
            ("Golf", plane.golf ?? false),
            ("Skis", plane.skis ?? false)
        ]
        return HStack(spacing: 12) {
            ForEach(checks.filter(\.1), id: \.0) { item in
                Text(item.0)
                    .font(KoriaFont.sans(12))
                    .foregroundStyle(koria.foreground)
            }
        }
    }
}
