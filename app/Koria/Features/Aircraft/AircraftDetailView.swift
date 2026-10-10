import SwiftUI

struct AircraftDetailView: View {
    let resultID: String
    @Environment(\.koria) private var koria
    @Environment(SearchViewModel.self) private var model

    var body: some View {
        Group {
            if let result = model.result(id: resultID) {
                content(result)
            } else {
                EmptyState(title: "Aircraft unavailable.", message: "Return to search and choose another option.")
                    .padding(KoriaSpace.lg)
            }
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Aircraft")
                    .koriaLabel()
            }
        }
    }

    private func content(_ result: SearchResult) -> some View {
        let listing = result.listing
        let plane = listing.aircraft
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                photoCarousel(listing)
                VStack(alignment: .leading, spacing: KoriaSpace.xl) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(listing.model.displayName)
                                .font(KoriaFont.display(32))
                                .foregroundStyle(koria.foreground)
                            Text("\(listing.model.category.displayName)  ·  \(plane.year)")
                                .font(KoriaFont.sans(15))
                                .foregroundStyle(koria.muted)
                        }
                        Spacer()
                        PriceLockup(offer: result.price)
                    }

                    SpecGrid(items: [
                        SpecItem(id: "pax", label: "Capacity", value: "\(plane.seating)"),
                        SpecItem(id: "interior", label: "Interior", value: plane.interiorConfiguration ?? "—"),
                        SpecItem(id: "bag", label: "Baggage", value: "\(plane.baggageCuFt ?? listing.model.baggageCuFt) cu ft"),
                        SpecItem(id: "wifi", label: "Wi‑Fi", value: yesNo(plane.wifi ?? listing.amenities.contains(where: { $0.kind == .wifi }))),
                        SpecItem(id: "lav", label: "Lavatory", value: yesNo(plane.lavatory ?? listing.amenities.contains(where: { $0.kind == .lavatory }))),
                        SpecItem(id: "pets", label: "Pets", value: yesNo(plane.pets ?? listing.amenities.contains(where: { $0.kind == .pets }))),
                        SpecItem(id: "golf", label: "Golf / skis", value: golfSkis(plane)),
                        SpecItem(id: "range", label: "Range", value: "\(listing.model.rangeNM) nm")
                    ])

                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: "Operator")
                        Text(listing.operatorProfile.name)
                            .font(KoriaFont.sans(17))
                            .foregroundStyle(koria.foreground)
                        if let legal = listing.operatorProfile.legalName {
                            Text(legal)
                                .font(KoriaFont.sans(14))
                                .foregroundStyle(koria.muted)
                        }
                        if let dba = listing.operatorProfile.dba {
                            Text("DBA \(dba)")
                                .font(KoriaFont.sans(14))
                                .foregroundStyle(koria.muted)
                        }
                        if !plane.tailNumber.isEmpty {
                            Text("Tail \(plane.tailNumber)")
                                .font(KoriaFont.sans(14))
                                .foregroundStyle(koria.muted)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: "Disclosure")
                        // TODO: aviation counsel
                        Text(BrokerDisclosure.fallback)
                            .font(KoriaFont.sans(14))
                            .foregroundStyle(koria.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: "This trip")
                        Text("\(result.origin.city) → \(result.destination.city)")
                            .font(KoriaFont.sans(17))
                            .foregroundStyle(koria.foreground)
                        Text("\(result.departureDate.koriaDateTime)  ·  \(result.distanceNM) nm  ·  \(result.passengers) pax")
                            .font(KoriaFont.sans(15))
                            .foregroundStyle(koria.muted)
                    }

                    KoriaButton(title: "Request this trip") {
                        model.path.append(SearchRoute.request(result.id))
                    }
                }
                .padding(KoriaSpace.lg)
                .padding(.bottom, KoriaSpace.xl)
            }
        }
    }

    @ViewBuilder
    private func photoCarousel(_ listing: AircraftListing) -> some View {
        let urls = listing.aircraft.photoURLs ?? []
        if urls.isEmpty {
            AircraftHero(
                category: listing.model.category,
                title: listing.model.displayName,
                subtitle: listing.aircraft.tailNumber
            )
        } else {
            TabView {
                ForEach(urls, id: \.self) { urlString in
                    AsyncImage(url: URL(string: urlString)) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            AircraftHero(
                                category: listing.model.category,
                                title: listing.model.displayName,
                                subtitle: listing.aircraft.tailNumber
                            )
                        }
                    }
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))
            .frame(height: 220)
        }
    }

    private func yesNo(_ value: Bool) -> String { value ? "Yes" : "No" }

    private func golfSkis(_ plane: OperatorAircraft) -> String {
        let golf = plane.golf ?? false
        let skis = plane.skis ?? false
        switch (golf, skis) {
        case (true, true): return "Golf & skis"
        case (true, false): return "Golf"
        case (false, true): return "Skis"
        default: return "No"
        }
    }
}

struct FlowAmenities: View {
    let items: [String]

    var body: some View {
        FlexibleChipRow(items: items)
    }
}

private struct FlexibleChipRow: View {
    let items: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 8) {
                    ForEach(row, id: \.self) { item in
                        AmenityChip(text: item)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private var rows: [[String]] {
        var result: [[String]] = []
        var current: [String] = []
        var count = 0
        for item in items {
            if count == 2 {
                result.append(current)
                current = [item]
                count = 1
            } else {
                current.append(item)
                count += 1
            }
        }
        if !current.isEmpty { result.append(current) }
        return result
    }
}
