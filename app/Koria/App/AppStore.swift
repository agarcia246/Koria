import Foundation

@MainActor
@Observable
final class AppStore {
    var trips: [Trip] = []
    var quotes: [Quote] = []
    var emptyLegs: [EmptyLeg] = []
    var passport: PassportProfile

    init() {
        self.passport = MockCatalog.shared.demoPassport
    }

    func upsert(_ trip: Trip) {
        if let index = trips.firstIndex(where: { $0.id == trip.id }) {
            trips[index] = trip
        } else {
            trips.insert(trip, at: 0)
        }
    }

    func upsert(_ quote: Quote) {
        if let index = quotes.firstIndex(where: { $0.id == quote.id }) {
            quotes[index] = quote
        } else {
            quotes.insert(quote, at: 0)
        }
    }

    func quotes(for tripID: String) -> [Quote] {
        quotes.filter { $0.tripID == tripID }.sorted { $0.createdAt > $1.createdAt }
    }
}
