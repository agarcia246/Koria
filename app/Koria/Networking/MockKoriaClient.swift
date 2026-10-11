import Foundation

@MainActor
final class MockKoriaClient: KoriaClient {
    private let catalog: MockCatalog
    private let store: AppStore

    init(catalog: MockCatalog = .shared, store: AppStore) {
        self.catalog = catalog
        self.store = store
        if store.emptyLegs.isEmpty {
            store.emptyLegs = catalog.emptyLegs
        }
        if store.passport.displayName.isEmpty {
            store.passport = catalog.demoPassport
        }
    }

    func searchAirports(query: String) async throws -> [Airport] {
        try await pause(220)
        return catalog.searchAirports(query)
    }

    func search(_ query: SearchQuery) async throws -> [SearchResult] {
        try await pause(480)
        guard let origin = catalog.airport(id: query.originID),
              let destination = catalog.airport(id: query.destinationID)
        else { throw KoriaError.invalidQuery("Choose both airports.") }

        if origin.id == destination.id {
            throw KoriaError.invalidQuery("Origin and destination need to be different.")
        }

        let distance = Geo.nauticalMiles(from: origin, to: destination)
        let requiredRange = distance * 1.15

        var results: [SearchResult] = []
        for listing in catalog.listings {
            guard listing.aircraft.seating >= query.passengers else { continue }
            guard Double(listing.model.rangeNM) >= requiredRange else { continue }
            if query.pets && !(listing.aircraft.pets ?? listing.amenities.contains(where: { $0.kind == .pets })) { continue }
            if query.wifiPreferred && !(listing.aircraft.wifi ?? listing.amenities.contains(where: { $0.kind == .wifi })) { continue }
            if query.golf && !(listing.aircraft.golf ?? listing.amenities.contains(where: { $0.kind == .golf || $0.kind == .ski })) { continue }
            if query.skis && !(listing.aircraft.skis ?? listing.amenities.contains(where: { $0.kind == .ski })) { continue }

            let price = price(for: listing, distanceNM: distance)
            let tradeoff = tradeoff(for: listing, query: query, distanceNM: distance)
            let tags = rankTags(for: listing, price: price, query: query)
            results.append(
                SearchResult(
                    id: listing.id,
                    listing: listing,
                    origin: origin,
                    destination: destination,
                    departureDate: query.departureDate,
                    passengers: query.passengers,
                    distanceNM: Int(distance.rounded()),
                    price: price,
                    tradeoff: tradeoff,
                    rankTags: tags
                )
            )
        }

        results.sort { lhs, rhs in
            rank(lhs, query: query) < rank(rhs, query: query)
        }

        return Array(results.prefix(6))
    }

    func listing(id: String) async throws -> AircraftListing {
        try await pause(180)
        guard let listing = catalog.listing(id: id) else { throw KoriaError.notFound }
        return listing
    }

    func emptyLegs() async throws -> [EmptyLeg] {
        try await pause(300)
        return store.emptyLegs.sorted { $0.departureDate < $1.departureDate }
    }

    func trips() async throws -> [Trip] {
        try await pause(160)
        return store.trips
    }

    func trip(id: String) async throws -> Trip {
        try await pause(120)
        guard let trip = store.trips.first(where: { $0.id == id }) else { throw KoriaError.notFound }
        return trip
    }

    func quotes(tripID: String) async throws -> [Quote] {
        try await pause(120)
        return store.quotes.filter { $0.tripID == tripID }
    }

    func submitTrip(_ draft: TripDraft) async throws -> Trip {
        try await pause(520)
        var trip = Trip(
            id: "trip-\(UUID().uuidString.prefix(8).lowercased())",
            createdAt: Date(),
            origin: draft.origin,
            destination: draft.destination,
            departureDate: draft.departureDate,
            returnDate: draft.returnDate,
            passengers: draft.passengers,
            aircraftID: draft.aircraftID,
            emptyLegID: draft.emptyLegID,
            notes: draft.notes,
            pets: draft.pets,
            wifiPreferred: draft.wifiPreferred,
            golf: draft.golf,
            skis: draft.skis,
            baggage: draft.baggage,
            status: .requested,
            booking: nil
        )
        store.upsert(trip)
        scheduleQuote(for: trip)
        return trip
    }

    func acceptQuote(id: String) async throws -> Trip {
        try await pause(400)
        guard var quote = store.quotes.first(where: { $0.id == id }) else { throw KoriaError.notFound }
        guard var trip = store.trips.first(where: { $0.id == quote.tripID }) else { throw KoriaError.notFound }
        quote.status = .accepted
        store.upsert(quote)
        for index in store.quotes.indices where store.quotes[index].tripID == trip.id && store.quotes[index].id != quote.id {
            store.quotes[index].status = .declined
        }
        let listing = trip.aircraftID.flatMap { catalog.listing(id: $0) }
        let booking = Booking(
            id: "bkg-\(UUID().uuidString.prefix(8).lowercased())",
            tripID: trip.id,
            quoteID: quote.id,
            status: .pending,
            createdAt: Date(),
            operatingCarrierLegalName: listing?.operatorProfile.legalName ?? listing?.operatorProfile.name,
            operatingCarrierDba: listing?.operatorProfile.dba,
            certificateNumber: "N12345",
            brokerRoleDisclosure: BrokerDisclosure.fallback,
            operatorAmount: quote.operatorAmount,
            platformFeeAmount: quote.platformFeeAmount,
            taxesAmount: quote.taxesAmount,
            customerTotal: quote.customerTotal,
            currency: quote.currency,
            fbo: nil
        )
        trip.status = .awaitingPayment
        trip.booking = booking
        store.upsert(trip)
        return trip
    }

    func declineQuote(id: String) async throws -> Quote {
        try await pause(280)
        guard var quote = store.quotes.first(where: { $0.id == id }) else { throw KoriaError.notFound }
        quote.status = .declined
        store.upsert(quote)
        if var trip = store.trips.first(where: { $0.id == quote.tripID }) {
            let pending = store.quotes.filter { $0.tripID == trip.id && $0.status == .pending }
            if pending.isEmpty {
                trip.status = .declined
                store.upsert(trip)
            }
        }
        return quote
    }

    func cancelTrip(id: String, reason: String) async throws -> Trip {
        try await pause(280)
        let trimmed = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw KoriaError.invalidQuery("A reason is required.") }
        guard var trip = store.trips.first(where: { $0.id == id }) else { throw KoriaError.notFound }
        let allowed: Set<TripStatus> = [.requested, .quoteReceived, .awaitingPayment, .confirmed, .upcoming]
        guard allowed.contains(trip.status) else { throw KoriaError.invalidQuery("This trip cannot be cancelled.") }
        trip.status = .cancelled
        trip.cancellationReason = trimmed
        if var booking = trip.booking {
            booking.status = .cancelled
            trip.booking = booking
        }
        store.upsert(trip)
        return trip
    }

    func passport() async throws -> PassportProfile {
        try await pause(120)
        return store.passport
    }

    func updatePassport(_ profile: PassportProfile) async throws -> PassportProfile {
        try await pause(240)
        store.passport = profile
        return profile
    }

    func requestAccess(email: String, name: String) async throws {
        try await pause(300)
        _ = (email, name)
    }

    func currentUser() async throws -> User {
        try await pause(100)
        return catalog.demoUser
    }

    private func scheduleQuote(for trip: Trip) {
        let aircraftID = trip.aircraftID ?? catalog.aircraft.first?.id
        guard let aircraftID, let listing = catalog.listing(id: aircraftID) else { return }
        let distance = Geo.nauticalMiles(from: trip.origin, to: trip.destination)
        let offer = price(for: listing, distanceNM: distance, forcePriced: true)
        let customerTotal = offer.amount?.amount ?? 0
        let operatorAmount = customerTotal * Decimal(string: "0.9")!
        let platformFee = customerTotal - operatorAmount

        Task { [weak self] in
            guard let self else { return }
            do {
                try await Task.sleep(for: .seconds(2.0))
                var quoted = trip
                quoted.status = .quoteReceived
                let quote = Quote(
                    id: "q-\(UUID().uuidString.prefix(8).lowercased())",
                    tripID: quoted.id,
                    aircraftID: listing.id,
                    operatorName: listing.operatorProfile.name,
                    price: offer,
                    operatorAmount: operatorAmount,
                    platformFeeAmount: platformFee,
                    taxesAmount: 0,
                    customerTotal: customerTotal,
                    currency: "USD",
                    validUntil: Calendar.current.date(byAdding: .hour, value: 36, to: Date()) ?? Date(),
                    operatorNotes: Self.operatorNote(for: listing, empty: trip.emptyLegID != nil),
                    status: .pending,
                    createdAt: Date(),
                    carrierDisclosure: CarrierDisclosure(
                        legalName: listing.operatorProfile.legalName,
                        dba: listing.operatorProfile.dba,
                        certificateNumber: "N12345",
                        brokerRoleDisclosure: BrokerDisclosure.fallback,
                        operationalControlDisclosure: BrokerDisclosure.fallback
                    )
                )
                self.store.upsert(quote)
                self.store.upsert(quoted)
            } catch {
                return
            }
        }
    }

    private func price(for listing: AircraftListing, distanceNM: Double, forcePriced: Bool = false) -> PriceOffer {
        let perNM: Decimal
        let minimum: Decimal
        switch listing.model.category {
        case .veryLight, .light:
            perNM = 18
            minimum = 7_500
        case .midsize:
            perNM = 24
            minimum = 12_000
        case .superMidsize:
            perNM = 32
            minimum = 16_000
        case .heavy:
            perNM = 42
            minimum = 24_000
        case .ultraLongRange:
            perNM = 58
            minimum = 38_000
        }
        let raw = max(minimum, perNM * Decimal(Int(distanceNM.rounded())))
        let rounded = (raw / 500 as NSDecimalNumber).intValue
        let amount = Money.usd(Decimal(rounded * 500))

        if forcePriced {
            return PriceOffer(mode: .live, amount: amount)
        }

        switch listing.model.id {
        case "phenom300", "citationx", "g450":
            return PriceOffer(mode: .live, amount: amount)
        case "cj4", "cl350", "falcon8x":
            return PriceOffer(mode: .estimated, amount: amount)
        default:
            return PriceOffer(mode: .quoteRequired, amount: nil)
        }
    }

    private func tradeoff(for listing: AircraftListing, query: SearchQuery, distanceNM: Double) -> String {
        if listing.model.category == .ultraLongRange {
            return "Ocean-crossing cabin. Quote from the operator."
        }
        if listing.model.cruiseSpeedKTAS >= 500 {
            return "Fastest aircraft that covers this sector."
        }
        if query.wifiPreferred && (listing.aircraft.wifi ?? listing.amenities.contains(where: { $0.kind == .wifi })) {
            return "Cabin Wi‑Fi confirmed. Right-sized for \(query.passengers)."
        }
        if distanceNM < 900 && (listing.model.category == .light || listing.model.category == .veryLight) {
            return "Right-sized for a short hop. No extra cabin you will not use."
        }
        if listing.model.category == .superMidsize || listing.model.category == .heavy {
            return "Stand-up cabin, quieter for the time in the air."
        }
        return "Capable of the mission, with a cabin that matches the passenger count."
    }

    private func rankTags(for listing: AircraftListing, price: PriceOffer, query: SearchQuery) -> [String] {
        var tags: [String] = []
        if price.mode == .live { tags.append("Best Value") }
        if listing.aircraft.seating == query.passengers || listing.aircraft.seating == query.passengers + 1 {
            tags.append("Best Experience")
        }
        if price.mode == .live || price.mode == .estimated {
            tags.append("Lowest Price")
        }
        return Array(tags.prefix(2))
    }

    private func rank(_ result: SearchResult, query: SearchQuery) -> Int {
        var score = 0
        switch result.price.mode {
        case .live: score += 0
        case .estimated: score += 10
        case .quoteRequired: score += 20
        }
        if query.wifiPreferred && (result.listing.aircraft.wifi ?? result.listing.amenities.contains(where: { $0.kind == .wifi })) {
            score -= 3
        }
        score += abs(result.listing.aircraft.seating - query.passengers)
        return score
    }

    private static func operatorNote(for listing: AircraftListing, empty: Bool) -> String {
        if empty {
            return "Empty leg confirmed subject to remaining reposition window. Crew and fuel already assigned."
        }
        return "\(listing.operatorProfile.name) can operate this trip on the requested aircraft, tail \(listing.aircraft.tailNumber). Handling at both FBOs is included."
    }

    private func pause(_ ms: UInt64) async throws {
        try await Task.sleep(for: .milliseconds(ms))
    }
}
