import Foundation

/// Typed REST client for the KORIA API (`/api/v1/...`).
final class LiveKoriaClient: KoriaClient {
    var baseURL: URL
    var session: URLSession
    var tokenProvider: () -> String?

    init(baseURL: URL, session: URLSession = .shared, tokenProvider: @escaping () -> String? = { nil }) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    func searchAirports(query: String) async throws -> [Airport] {
        try await get(path: "/api/v1/airports/search", query: ["q": query])
    }

    func search(_ query: SearchQuery) async throws -> [SearchResult] {
        try await post(path: "/api/v1/search", body: SearchRequestDTO(query))
    }

    func listing(id: String) async throws -> AircraftListing {
        try await get(path: "/api/v1/aircraft/\(id)")
    }

    func emptyLegs() async throws -> [EmptyLeg] {
        let rows: [EmptyLegDTO] = try await get(path: "/api/v1/empty-legs")
        return rows.map(\.model)
    }

    func trips() async throws -> [Trip] {
        try await get(path: "/api/v1/trips")
    }

    func trip(id: String) async throws -> Trip {
        try await get(path: "/api/v1/trips/\(id)")
    }

    func quotes(tripID: String) async throws -> [Quote] {
        try await get(path: "/api/v1/trips/\(tripID)/quotes")
    }

    func submitTrip(_ draft: TripDraft) async throws -> Trip {
        try await post(path: "/api/v1/trips", body: draft)
    }

    func acceptQuote(id: String) async throws -> Trip {
        try await post(path: "/api/v1/quotes/\(id)/accept", body: QuoteDecisionDTO(quoteID: id, accept: true))
    }

    func declineQuote(id: String) async throws -> Quote {
        try await post(path: "/api/v1/quotes/\(id)/decline", body: QuoteDecisionDTO(quoteID: id, accept: false))
    }

    func cancelTrip(id: String, reason: String) async throws -> Trip {
        try await post(path: "/api/v1/trips/\(id)/cancel", body: CancelTripDTO(reason: reason))
    }

    func passport() async throws -> PassportProfile {
        try await get(path: "/api/v1/me/passport")
    }

    func updatePassport(_ profile: PassportProfile) async throws -> PassportProfile {
        try await patch(path: "/api/v1/me/passport", body: profile)
    }

    func requestAccess(email: String, name: String) async throws {
        let _: EmptyResponse = try await post(path: "/api/v1/access-requests", body: AccessRequestDTO(email: email, name: name))
    }

    func currentUser() async throws -> User {
        try await get(path: "/api/v1/me")
    }

    func acceptTerms() async throws -> User {
        let _: TermsAcceptanceDTO = try await post(path: "/api/v1/me/accept-terms", body: EmptyJSON())
        return try await currentUser()
    }

    func exportData() async throws -> Data {
        let url = baseURL.appending(path: "api/v1/me/export")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        applyHeaders(&request)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw KoriaError.network("Invalid response.")
        }
        if (200...299).contains(http.statusCode) { return data }
        throw apiError(data: data, status: http.statusCode)
    }

    func deleteAccount() async throws {
        let _: EmptyResponse = try await post(path: "/api/v1/me/delete", body: EmptyJSON())
    }

    func notifications(limit: Int, offset: Int) async throws -> NotificationPage {
        try await get(
            path: "/api/v1/me/notifications",
            query: ["limit": String(limit), "offset": String(offset)]
        )
    }

    func markNotificationRead(id: String) async throws -> InboxNotification {
        try await post(path: "/api/v1/me/notifications/\(id)/read", body: EmptyJSON())
    }

    private func get<T: Decodable>(path: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(url: baseURL.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))), resolvingAgainstBaseURL: false)
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw KoriaError.network("Invalid URL.") }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        applyHeaders(&request)
        return try await decode(request)
    }

    private func post<Body: Encodable, T: Decodable>(path: String, body: Body) async throws -> T {
        try await send(path: path, method: "POST", body: body)
    }

    private func patch<Body: Encodable, T: Decodable>(path: String, body: Body) async throws -> T {
        try await send(path: path, method: "PATCH", body: body)
    }

    private func send<Body: Encodable, T: Decodable>(path: String, method: String, body: Body) async throws -> T {
        let url = baseURL.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        var request = URLRequest(url: url)
        request.httpMethod = method
        applyHeaders(&request)
        request.httpBody = try encoder.encode(body)
        return try await decode(request)
    }

    private func applyHeaders(_ request: inout URLRequest) {
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = tokenProvider() ?? KeychainStore.get(KeychainStore.tokenKey) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func decode<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw KoriaError.network("Invalid response.")
        }
        switch http.statusCode {
        case 200...299:
            if T.self == EmptyResponse.self, data.isEmpty {
                return EmptyResponse() as! T
            }
            return try decoder.decode(T.self, from: data)
        case 401:
            throw KoriaError.unauthorized
        case 404:
            throw KoriaError.notFound
        default:
            throw apiError(data: data, status: http.statusCode)
        }
    }

    private func apiError(data: Data, status: Int) -> KoriaError {
        if status == 401 { return .unauthorized }
        if status == 404 { return .notFound }
        if let payload = try? JSONDecoder().decode(APIErrorBody.self, from: data) {
            switch payload.error {
            case "terms_required": return .termsRequired
            case "operator_member": return .operatorMember
            case "open_trip": return .openTrip
            default:
                if !payload.error.isEmpty { return .network(payload.error) }
            }
        }
        return .network("Server returned \(status).")
    }

    private var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom(KoriaJSONDate.decode)
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }

    private var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }
}

private struct EmptyResponse: Decodable {
    init() {}
}

private struct EmptyJSON: Encodable {}

/// Live empty legs can omit price, seats, or notes. The app model keeps those fields required.
private struct EmptyLegDTO: Decodable {
    var id: String
    var listing: AircraftListing
    var origin: Airport
    var destination: Airport
    var departureDate: Date
    var seatsAvailable: Int?
    var price: PriceOffer?
    var notes: String?

    var model: EmptyLeg {
        EmptyLeg(
            id: id,
            listing: listing,
            origin: origin,
            destination: destination,
            departureDate: departureDate,
            seatsAvailable: seatsAvailable ?? listing.aircraft.seating,
            price: price ?? PriceOffer(mode: .quoteRequired, amount: nil),
            notes: notes ?? ""
        )
    }
}

private enum KoriaJSONDate {
    static func decode(_ decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        if let date = parse(raw) { return date }
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Unrecognized date \(raw)."
        )
    }

    private static func parse(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: raw) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }
}

private struct APIErrorBody: Decodable {
    var error: String
}

private struct TermsAcceptanceDTO: Decodable {
    var termsVersionRequired: String
    var termsAccepted: Bool
}
