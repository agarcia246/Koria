import Foundation

enum AircraftCategory: String, Codable, CaseIterable, Hashable, Sendable {
    case veryLight
    case light
    case midsize
    case superMidsize
    case heavy
    case ultraLongRange

    var displayName: String {
        switch self {
        case .veryLight: "Very Light"
        case .light: "Light"
        case .midsize: "Midsize"
        case .superMidsize: "Super-Midsize"
        case .heavy: "Heavy"
        case .ultraLongRange: "Ultra-Long Range"
        }
    }
}

enum PricingMode: String, Codable, Hashable, Sendable {
    case live
    case estimated
    case quoteRequired = "quote_required"

    var label: String {
        switch self {
        case .live: "LIVE PRICE"
        case .estimated: "ESTIMATED PRICE"
        case .quoteRequired: "QUOTE REQUIRED"
        }
    }
}

enum TripStatus: String, Codable, Hashable, Sendable {
    case requested
    case quoteReceived = "quote_received"
    case awaitingPayment = "awaiting_payment"
    case confirmed
    case upcoming
    case completed
    case cancelled
    case declined

    var displayName: String {
        switch self {
        case .requested: "Requested"
        case .quoteReceived: "Quote ready"
        case .awaitingPayment: "Awaiting payment"
        case .confirmed: "Confirmed"
        case .upcoming: "Upcoming"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        case .declined: "Declined"
        }
    }

    var isPositive: Bool {
        switch self {
        case .quoteReceived, .awaitingPayment, .confirmed, .upcoming, .completed: true
        default: false
        }
    }
}

enum QuoteStatus: String, Codable, Hashable, Sendable {
    case pending
    case accepted
    case declined
    case expired
    case countered

    var displayName: String {
        switch self {
        case .pending: "Pending"
        case .accepted: "Accepted"
        case .declined: "Declined"
        case .expired: "Expired"
        case .countered: "Countered"
        }
    }
}

enum BookingStatus: String, Codable, Hashable, Sendable {
    case pending
    case confirmed
    case completed
    case cancelled

    var displayName: String {
        switch self {
        case .pending: "Pending"
        case .confirmed: "Confirmed"
        case .completed: "Completed"
        case .cancelled: "Cancelled"
        }
    }
}

enum AccessStatus: String, Codable, Hashable, Sendable {
    case requested
    case approved
    case declined
    case invited
}

enum AmenityKind: String, Codable, Hashable, Sendable {
    case wifi
    case entertainment
    case lavatory
    case galley
    case pets
    case ski
    case golf
    case beds
    case shower
    case conference
}

struct Money: Hashable, Codable, Sendable {
    var amount: Decimal
    var currency: String

    static func usd(_ amount: Decimal) -> Money {
        Money(amount: amount, currency: "USD")
    }

    var formatted: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSDecimalNumber(decimal: amount)) ?? "\(currency) \(amount)"
    }
}

struct PriceOffer: Hashable, Codable, Sendable {
    var mode: PricingMode
    var amount: Money?

    var displayAmount: String {
        switch mode {
        case .quoteRequired:
            return "On request"
        case .live, .estimated:
            return amount?.formatted ?? "—"
        }
    }

    var accessibilityLabel: String {
        switch mode {
        case .live:
            return "Live price \(displayAmount)"
        case .estimated:
            return "Estimated price \(displayAmount)"
        case .quoteRequired:
            return "Quote required"
        }
    }
}

struct Airport: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var icao: String
    var iata: String
    var name: String
    var city: String
    var region: String
    var country: String
    var timeZone: String
    var latitude: Double
    var longitude: Double

    var primaryLabel: String { city }
    var secondaryLabel: String { "\(iata) · \(name)" }
    var searchBlob: String {
        "\(city) \(name) \(iata) \(icao) \(region) \(country)".lowercased()
    }
}

struct AircraftModel: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var manufacturer: String
    var name: String
    var category: AircraftCategory
    var rangeNM: Int
    var cruiseSpeedKTAS: Int
    var typicalPax: Int
    var maxPax: Int
    var cabinLengthFt: Double
    var cabinWidthFt: Double
    var cabinHeightFt: Double
    var baggageCuFt: Int

    var displayName: String { "\(manufacturer) \(name)" }
}

struct Amenity: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var name: String
    var kind: AmenityKind
}

struct OperatorProfile: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var name: String
    var code: String
    var city: String
    var legalName: String?
    var dba: String?
}

struct OperatorAircraft: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var tailNumber: String
    var operatorID: String
    var modelID: String
    var seating: Int
    var year: Int
    var amenityIDs: [String]
    var petPolicy: String
    var cabinNotes: String
    var homeBaseID: String
    var interiorConfiguration: String?
    var baggageCuFt: Int?
    var wifi: Bool?
    var lavatory: Bool?
    var pets: Bool?
    var golf: Bool?
    var skis: Bool?
    var photoURLs: [String]?
}

struct AircraftListing: Identifiable, Hashable, Codable, Sendable {
    var aircraft: OperatorAircraft
    var model: AircraftModel
    var operatorProfile: OperatorProfile
    var amenities: [Amenity]

    var id: String { aircraft.id }
}

struct SearchQuery: Hashable, Codable, Sendable {
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
}

struct SearchResult: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var listing: AircraftListing
    var origin: Airport
    var destination: Airport
    var departureDate: Date
    var passengers: Int
    var distanceNM: Int
    var price: PriceOffer
    var tradeoff: String
    var rankTags: [String]
}

struct Trip: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var createdAt: Date
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
    var status: TripStatus
    var booking: Booking?
    var cancellationReason: String? = nil
    var cancelledBy: String? = nil
    var documents: [TripDocument] = []
}

struct TripDocument: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var title: String
    var url: String?
}

struct CarrierDisclosure: Hashable, Codable, Sendable {
    var legalName: String?
    var dba: String?
    var certificateNumber: String?
    var brokerRoleDisclosure: String?
    var operationalControlDisclosure: String?
}

struct Quote: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var tripID: String
    var aircraftID: String
    var operatorName: String
    var price: PriceOffer
    var operatorAmount: Decimal?
    var platformFeeAmount: Decimal?
    var taxesAmount: Decimal?
    var customerTotal: Decimal?
    var currency: String
    var validUntil: Date
    var operatorNotes: String
    var status: QuoteStatus
    var createdAt: Date
    var carrierDisclosure: CarrierDisclosure?
}

struct Booking: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var tripID: String
    var quoteID: String
    var status: BookingStatus
    var createdAt: Date
    var operatingCarrierLegalName: String?
    var operatingCarrierDba: String?
    var certificateNumber: String?
    var brokerRoleDisclosure: String?
    var operatorAmount: Decimal?
    var platformFeeAmount: Decimal?
    var taxesAmount: Decimal?
    var customerTotal: Decimal?
    var currency: String?
    var fbo: String?
}

struct EmptyLeg: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var listing: AircraftListing
    var origin: Airport
    var destination: Airport
    var departureDate: Date
    var seatsAvailable: Int
    var price: PriceOffer
    var notes: String
}

struct PassportStamp: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var title: String
    var detail: String
    var isEarned: Bool
}

struct SavedPassenger: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var fullName: String
    var dateOfBirth: Date?
    var weightLb: Int?
}

struct PassportProfile: Hashable, Codable, Sendable {
    var displayName: String
    var email: String
    var photoURL: String?
    var homeAirportID: String?
    var typicalPassengers: Int
    var pets: Bool
    var wifiPreferred: Bool
    var golf: Bool
    var skis: Bool
    var aircraftPreferences: [String]
    var passengers: [SavedPassenger]
    var stamps: [PassportStamp]
}

struct User: Identifiable, Hashable, Codable, Sendable {
    var id: String
    var name: String
    var email: String
    var accessStatus: AccessStatus
    var termsVersionRequired: String
    var termsAccepted: Bool
}

enum KoriaError: LocalizedError, Equatable {
    case unauthorized
    case notFound
    case invalidQuery(String)
    case network(String)
    case notImplemented
    case accessPending
    case termsRequired
    case operatorMember
    case openTrip

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Please sign in to continue."
        case .notFound: "We could not find that item."
        case .invalidQuery(let message): message
        case .network(let message): message
        case .notImplemented: "This service is not connected yet."
        case .accessPending: "Your early access request is still pending."
        case .termsRequired: "Accept the current terms and privacy policy to request a trip."
        case .operatorMember: "This account is on an operator team and cannot be deleted here."
        case .openTrip: "A trip is awaiting payment, confirmed, or upcoming. You can delete the account after it is completed or cancelled."
        }
    }
}

enum Geo {
    static func nauticalMiles(from a: Airport, to b: Airport) -> Double {
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 3440.065 * 2 * atan2(sqrt(h), sqrt(1 - h))
    }
}

struct NotificationPage: Decodable, Hashable, Sendable {
    var notifications: [InboxNotification]
    var limit: Int
    var offset: Int
    var hasMore: Bool
}

struct InboxNotification: Identifiable, Decodable, Hashable, Sendable {
    var id: String
    var title: String?
    var body: String?
    var event: String?
    var tripRequestId: String?
    var readAt: Date?
    var createdAt: Date
}

enum BrokerDisclosure {
    /// Used only when the booking has no `broker_role_disclosure` snapshot.
    /// Counsel replaces the server text in `web/src/lib/disclosures.ts`.
    static let fallback = "PENDING COUNSEL. KORIA acts as an air charter broker, not the operator of the aircraft. The direct air carrier named on this trip has operational control."
}

extension Date {
    var koriaMedium: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: self)
    }

    var koriaShort: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM"
        return formatter.string(from: self)
    }

    var koriaDateTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM · HH:mm"
        return formatter.string(from: self)
    }
}
