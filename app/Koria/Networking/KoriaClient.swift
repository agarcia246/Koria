import Foundation

protocol KoriaClient: AnyObject {
    func searchAirports(query: String) async throws -> [Airport]
    func search(_ query: SearchQuery) async throws -> [SearchResult]
    func listing(id: String) async throws -> AircraftListing
    func emptyLegs() async throws -> [EmptyLeg]
    func trips() async throws -> [Trip]
    func trip(id: String) async throws -> Trip
    func quotes(tripID: String) async throws -> [Quote]
    func submitTrip(_ draft: TripDraft) async throws -> Trip
    func acceptQuote(id: String) async throws -> Trip
    func declineQuote(id: String) async throws -> Quote
    func cancelTrip(id: String, reason: String) async throws -> Trip
    func passport() async throws -> PassportProfile
    func updatePassport(_ profile: PassportProfile) async throws -> PassportProfile
    func requestAccess(email: String, name: String) async throws
    func currentUser() async throws -> User
    func notifications(limit: Int, offset: Int) async throws -> NotificationPage
    func markNotificationRead(id: String) async throws -> InboxNotification
}

struct TripDraft: Hashable, Codable, Sendable {
    var origin: Airport
    var destination: Airport
    var departureDate: Date
    var returnDate: Date?
    var passengers: Int
    var aircraftID: String?
    var emptyLegID: String?
    var notes: String
    var pets: Bool
    var wifiPreferred: Bool
    var golf: Bool
    var skis: Bool
    var baggage: Bool
}

struct SearchRequestDTO: Codable, Sendable {
    var originID: String
    var destinationID: String
    var departureDate: Date
    var returnDate: Date?
    var passengers: Int
    var pets: Bool
    var wifiPreferred: Bool
    var golf: Bool
    var skis: Bool
    var baggage: Bool
    var flexibleDays: Int
    var nearbyAirports: Bool

    init(_ query: SearchQuery) {
        originID = query.originID
        destinationID = query.destinationID
        departureDate = query.departureDate
        returnDate = query.returnDate
        passengers = query.passengers
        pets = query.pets
        wifiPreferred = query.wifiPreferred
        golf = query.golf
        skis = query.skis
        baggage = query.baggage
        flexibleDays = query.flexibleDays
        nearbyAirports = query.nearbyAirports
    }
}

struct QuoteDecisionDTO: Codable, Sendable {
    var quoteID: String
    var accept: Bool
}

struct CancelTripDTO: Codable, Sendable {
    var reason: String
}

struct AccessRequestDTO: Codable, Sendable {
    var email: String
    var name: String
}
