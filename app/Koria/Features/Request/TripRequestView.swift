import SwiftUI

enum RequestContext: Hashable {
    case search(aircraftID: String)
    case empty(emptyLegID: String)
}

struct TripRequestView: View {
    let context: RequestContext
    @Environment(\.koria) private var koria
    @Environment(AppDependencies.self) private var dependencies
    @Environment(AppSession.self) private var session
    @Environment(SearchViewModel.self) private var search
    @State private var notes = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.xl) {
                Text("Request\nthis trip.")
                    .font(KoriaFont.display(44))
                    .foregroundStyle(koria.foreground)

                if let summary = summary {
                    VStack(alignment: .leading, spacing: KoriaSpace.md) {
                        row("Route", "\(summary.origin.city) → \(summary.destination.city)")
                        row("When", summary.date.koriaDateTime)
                        row("Who", "\(summary.passengers) passengers")
                        row("Aircraft", summary.aircraftName)
                        row("Operator", summary.operatorName)
                        row("Pricing", summary.price.mode.label + "  " + summary.price.displayAmount)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: "Notes for the operator")
                    TextField("Pets, skis, catering, timing", text: $notes, axis: .vertical)
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.foreground)
                        .lineLimit(3...6)
                    KoriaDivider()
                }

                Text("KORIA sends this to the operator. You will see a live quote in Trips — usually within a few seconds in this demo.")
                    .font(KoriaFont.sans(14))
                    .foregroundStyle(koria.muted)

                if let errorMessage {
                    Text(errorMessage)
                        .font(KoriaFont.sans(14))
                        .foregroundStyle(koria.muted)
                }

                KoriaButton(title: "Request this trip", isLoading: isSubmitting, isEnabled: summary != nil) {
                    Task { await submit() }
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Request")
                    .koriaLabel()
            }
        }
    }

    private var summary: RequestSummary? {
        switch context {
        case .search(let id):
            guard let result = search.result(id: id) else { return nil }
            return RequestSummary(
                origin: result.origin,
                destination: result.destination,
                date: result.departureDate,
                passengers: result.passengers,
                aircraftID: result.listing.id,
                emptyLegID: nil,
                aircraftName: result.listing.model.displayName,
                operatorName: result.listing.operatorProfile.name,
                price: result.price,
                pets: search.pets,
                wifiPreferred: search.wifiPreferred,
                golf: search.golf,
                skis: search.skis,
                baggage: search.baggage
            )
        case .empty(let id):
            guard let leg = emptyLeg(id: id, dependencies: dependencies) else { return nil }
            return RequestSummary(
                origin: leg.origin,
                destination: leg.destination,
                date: leg.departureDate,
                passengers: min(search.passengers, leg.seatsAvailable),
                aircraftID: leg.listing.id,
                emptyLegID: leg.id,
                aircraftName: leg.listing.model.displayName,
                operatorName: leg.listing.operatorProfile.name,
                price: leg.price,
                pets: search.pets,
                wifiPreferred: search.wifiPreferred,
                golf: search.golf,
                skis: search.skis,
                baggage: search.baggage
            )
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).koriaLabel()
            Text(value)
                .font(KoriaFont.sans(17))
                .foregroundStyle(koria.foreground)
            KoriaDivider()
        }
    }

    private func submit() async {
        guard let summary else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let draft = TripDraft(
                origin: summary.origin,
                destination: summary.destination,
                departureDate: summary.date,
                returnDate: nil,
                passengers: summary.passengers,
                aircraftID: summary.aircraftID,
                emptyLegID: summary.emptyLegID,
                notes: notes,
                pets: summary.pets,
                wifiPreferred: summary.wifiPreferred,
                golf: summary.golf,
                skis: summary.skis,
                baggage: summary.baggage
            )
            _ = try await dependencies.client.submitTrip(draft)
            search.path = NavigationPath()
            session.selectedTab = .trips
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct RequestSummary {
    var origin: Airport
    var destination: Airport
    var date: Date
    var passengers: Int
    var aircraftID: String
    var emptyLegID: String?
    var aircraftName: String
    var operatorName: String
    var price: PriceOffer
    var pets: Bool
    var wifiPreferred: Bool
    var golf: Bool
    var skis: Bool
    var baggage: Bool
}
