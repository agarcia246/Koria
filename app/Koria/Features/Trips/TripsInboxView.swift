import SwiftUI

struct TripsInboxView: View {
    @Environment(\.koria) private var koria
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                Text("Trips")
                    .font(KoriaFont.display(48))
                    .foregroundStyle(koria.foreground)
                    .padding(.top, KoriaSpace.sm)

                if store.trips.isEmpty {
                    EmptyState(
                        title: "Nothing requested yet.",
                        message: "Start with Fly. When an operator responds, the quote will land here."
                    )
                } else {
                    ForEach(store.trips) { trip in
                        NavigationLink(value: trip.id) {
                            TripRow(trip: trip, quotes: store.quotes(for: trip.id))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                KoriaMark()
                    .frame(width: 22, height: 22)
                    .foregroundStyle(koria.foreground)
            }
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    NotificationsInboxView()
                } label: {
                    Image(systemName: "bell")
                        .foregroundStyle(koria.foreground)
                }
                .accessibilityLabel("Notifications")
            }
        }
        .navigationDestination(for: String.self) { id in
            TripDetailView(tripID: id)
        }
    }
}

struct TripRow: View {
    let trip: Trip
    let quotes: [Quote]
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            HStack {
                StatusPill(text: trip.status.displayName, tone: trip.status.isPositive ? .live : .neutral)
                Spacer()
                Text(trip.createdAt.koriaShort)
                    .font(KoriaFont.sans(13))
                    .foregroundStyle(koria.muted)
            }
            Text("\(trip.origin.city) → \(trip.destination.city)")
                .font(KoriaFont.display(28))
                .foregroundStyle(koria.foreground)
            Text("\(trip.departureDate.koriaDateTime)  ·  \(trip.passengers) pax")
                .font(KoriaFont.sans(14))
                .foregroundStyle(koria.muted)
            if let quote = quotes.first(where: { $0.status == .pending || $0.status == .accepted }) {
                Text(quote.price.displayAmount)
                    .font(KoriaFont.sans(16, weight: .medium))
                    .foregroundStyle(koria.foreground)
            }
        }
        .padding(KoriaSpace.lg)
        .background(koria.surface)
    }
}

struct TripDetailView: View {
    let tripID: String
    @Environment(\.koria) private var koria
    @Environment(AppStore.self) private var store
    @Environment(AppDependencies.self) private var dependencies
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var cancelReason = ""

    var body: some View {
        Group {
            if let trip = store.trips.first(where: { $0.id == tripID }) {
                content(trip)
            } else {
                EmptyState(title: "Trip not found.", message: "It may have been removed from this session.")
                    .padding(KoriaSpace.lg)
            }
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Trip")
                    .koriaLabel()
            }
        }
        .task(id: tripID) {
            guard let fresh = try? await dependencies.client.trip(id: tripID) else { return }
            store.upsert(fresh)
        }
    }

    private func content(_ trip: Trip) -> some View {
        let quotes = store.quotes(for: trip.id)
        let listing = trip.aircraftID.flatMap { dependencies.catalog.listing(id: $0) }
        return ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.xl) {
                VStack(alignment: .leading, spacing: 8) {
                    StatusPill(text: trip.status.displayName, tone: trip.status.isPositive ? .live : .neutral)
                    Text("\(trip.origin.city) → \(trip.destination.city)")
                        .font(KoriaFont.display(40))
                        .foregroundStyle(koria.foreground)
                    Text("\(trip.departureDate.koriaDateTime)  ·  \(trip.passengers) passengers")
                        .font(KoriaFont.sans(15))
                        .foregroundStyle(koria.muted)
                }

                timeline(trip)

                if trip.status == .confirmed || trip.status == .upcoming || trip.status == .awaitingPayment,
                   let booking = trip.booking {
                    confirmedDetail(trip: trip, booking: booking, listing: listing)
                } else if trip.status == .completed {
                    documentsList(trip)
                }

                VStack(alignment: .leading, spacing: KoriaSpace.md) {
                    SectionLabel(text: "Quotes")
                    if quotes.isEmpty {
                        if trip.status == .requested {
                            VStack(alignment: .leading, spacing: 10) {
                                SkeletonBlock(height: 14)
                                SkeletonBlock(height: 28)
                                Text("Waiting on the operator.")
                                    .font(KoriaFont.sans(14))
                                    .foregroundStyle(koria.muted)
                            }
                        } else {
                            Text("No quotes yet.")
                                .font(KoriaFont.sans(15))
                                .foregroundStyle(koria.muted)
                        }
                    } else {
                        ForEach(quoteGroups(quotes)) { group in
                            VStack(alignment: .leading, spacing: KoriaSpace.sm) {
                                Text(group.operatorName)
                                    .font(KoriaFont.sans(13, weight: .medium))
                                    .tracking(1.2)
                                    .textCase(.uppercase)
                                    .foregroundStyle(koria.muted)
                                Text(group.aircraftName)
                                    .font(KoriaFont.sans(16, weight: .medium))
                                    .foregroundStyle(koria.foreground)
                                ForEach(group.quotes) { quote in
                                    QuoteCard(quote: quote, aircraftName: group.aircraftName, isWorking: isWorking) { accept in
                                        Task { await decide(quoteID: quote.id, accept: accept) }
                                    }
                                }
                            }
                        }
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(KoriaFont.sans(14))
                        .foregroundStyle(koria.muted)
                }

                if canCancel(trip) {
                    cancelSection(trip)
                } else if let reason = trip.cancellationReason, !reason.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        SectionLabel(text: "Cancellation")
                        Text(reason)
                            .font(KoriaFont.sans(15))
                            .foregroundStyle(koria.foreground)
                    }
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
    }

    @ViewBuilder
    private func confirmedDetail(trip: Trip, booking: Booking, listing: AircraftListing?) -> some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            SectionLabel(text: "Confirmed trip")
            if let listing {
                row("Aircraft", listing.model.displayName)
                row("Operator", listing.operatorProfile.name)
            }
            // TODO: aviation counsel
            Text(booking.brokerRoleDisclosure ?? BrokerDisclosure.fallback)
                .font(KoriaFont.sans(14))
                .foregroundStyle(koria.muted)
                .fixedSize(horizontal: false, vertical: true)
            row("Departure", trip.departureDate.koriaDateTime)
            row("FBO", booking.fbo ?? "FBO to be confirmed")
            row("Passengers", "\(trip.passengers)")
            let prefs = [
                trip.wifiPreferred ? "Wi‑Fi" : nil,
                trip.pets ? "Pets" : nil,
                trip.golf ? "Golf" : nil,
                trip.skis ? "Skis" : nil,
                trip.baggage ? "Baggage" : nil
            ].compactMap { $0 }
            if !prefs.isEmpty {
                row("Preferences", prefs.joined(separator: " · "))
            }
            documentsList(trip)
            row("Support", "support@koria.travel")
            Text("Reference \(booking.id.uppercased())")
                .font(KoriaFont.sans(13))
                .foregroundStyle(koria.muted)
        }
    }

    @ViewBuilder
    private func documentsList(_ trip: Trip) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Documents").koriaLabel()
            if trip.documents.isEmpty {
                Text("No documents yet.")
                    .font(KoriaFont.sans(16))
                    .foregroundStyle(koria.muted)
            } else {
                ForEach(trip.documents) { document in
                    if let raw = document.url, let link = URL(string: raw) {
                        Link(destination: link) {
                            Text(document.title)
                                .font(KoriaFont.sans(16))
                                .foregroundStyle(koria.foreground)
                        }
                    } else {
                        Text(document.title)
                            .font(KoriaFont.sans(16))
                            .foregroundStyle(koria.muted)
                    }
                }
            }
            KoriaDivider()
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).koriaLabel()
            Text(value)
                .font(KoriaFont.sans(16))
                .foregroundStyle(koria.foreground)
            KoriaDivider()
        }
    }

    private func timeline(_ trip: Trip) -> some View {
        let steps: [(String, Bool)] = [
            ("Requested", true),
            ("Quote ready", [.quoteReceived, .awaitingPayment, .confirmed, .upcoming, .completed].contains(trip.status)),
            ("Awaiting payment", [.awaitingPayment, .confirmed, .upcoming, .completed].contains(trip.status)),
            ("Confirmed", [.confirmed, .upcoming, .completed].contains(trip.status))
        ]
        return VStack(alignment: .leading, spacing: KoriaSpace.md) {
            SectionLabel(text: "Status")
            ForEach(Array(steps.enumerated()), id: \.offset) { _, step in
                HStack(spacing: 12) {
                    Circle()
                        .fill(step.1 ? koria.accent : koria.hairline)
                        .frame(width: 7, height: 7)
                    Text(step.0)
                        .font(KoriaFont.sans(15))
                        .foregroundStyle(step.1 ? koria.foreground : koria.muted)
                }
            }
        }
    }

    private func quoteGroups(_ quotes: [Quote]) -> [OperatorQuoteGroup] {
        let keys = Set(quotes.map { "\($0.operatorName)\u{1f}\($0.aircraftID)" })
        return keys.sorted().compactMap { key -> OperatorQuoteGroup? in
            let parts = key.split(separator: "\u{1f}", maxSplits: 1).map(String.init)
            guard parts.count == 2 else { return nil }
            let name = parts[0]
            let aircraftID = parts[1]
            let aircraftName = dependencies.catalog.listing(id: aircraftID)?.model.displayName ?? "Aircraft"
            let grouped = quotes
                .filter { $0.operatorName == name && $0.aircraftID == aircraftID }
                .sorted { $0.createdAt > $1.createdAt }
            return OperatorQuoteGroup(
                operatorName: name,
                aircraftID: aircraftID,
                aircraftName: aircraftName,
                quotes: grouped
            )
        }
    }

    private func canCancel(_ trip: Trip) -> Bool {
        [.requested, .quoteReceived, .awaitingPayment, .confirmed, .upcoming].contains(trip.status)
    }

    private func cancelSection(_ trip: Trip) -> some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            SectionLabel(text: "Cancel trip")
            TextField("Reason", text: $cancelReason, axis: .vertical)
                .font(KoriaFont.sans(15))
                .lineLimit(2...4)
            Text("Cancelling does not move money.")
                .font(KoriaFont.sans(13))
                .foregroundStyle(koria.muted)
            KoriaButton(title: "Cancel trip", style: .secondary, isLoading: isWorking) {
                Task { await cancel(trip) }
            }
        }
    }

    private func cancel(_ trip: Trip) async {
        let reason = cancelReason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !reason.isEmpty else {
            errorMessage = "A reason is required."
            return
        }
        isWorking = true
        defer { isWorking = false }
        do {
            let updated = try await dependencies.client.cancelTrip(id: trip.id, reason: reason)
            store.upsert(updated)
            cancelReason = ""
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func decide(quoteID: String, accept: Bool) async {
        isWorking = true
        defer { isWorking = false }
        do {
            if accept {
                let updated = try await dependencies.client.acceptQuote(id: quoteID)
                store.upsert(updated)
                let fresh = try await dependencies.client.quotes(tripID: updated.id)
                for quote in fresh {
                    store.upsert(quote)
                }
            } else {
                let quote = try await dependencies.client.declineQuote(id: quoteID)
                store.upsert(quote)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct OperatorQuoteGroup: Identifiable {
    let operatorName: String
    let aircraftID: String
    let aircraftName: String
    let quotes: [Quote]
    var id: String { "\(operatorName)-\(aircraftID)" }
}

struct QuoteCard: View {
    let quote: Quote
    var aircraftName: String
    var isWorking: Bool
    var decide: (Bool) -> Void
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            HStack {
                Text(aircraftName)
                    .font(KoriaFont.sans(16, weight: .medium))
                    .foregroundStyle(koria.foreground)
                Spacer()
                StatusPill(text: quote.status.displayName, tone: quote.status == .accepted ? .live : .neutral)
            }
            Text(quote.operatorName)
                .koriaLabel()
            PriceLockup(offer: quote.price)
            Text(quote.operatorNotes)
                .font(KoriaFont.sans(15))
                .foregroundStyle(koria.muted)
                .fixedSize(horizontal: false, vertical: true)
            Text("Valid until \(quote.validUntil.koriaDateTime)")
                .font(KoriaFont.sans(13))
                .foregroundStyle(koria.muted)

            if quote.status == .pending {
                VStack(spacing: KoriaSpace.sm) {
                    KoriaButton(title: "Book trip", isLoading: isWorking) {
                        decide(true)
                    }
                    KoriaButton(title: "Decline", style: .secondary, isEnabled: !isWorking) {
                        decide(false)
                    }
                }
            }
        }
        .padding(KoriaSpace.lg)
        .background(koria.surface)
    }
}
