import Foundation
import SwiftUI

enum SearchRoute: Hashable {
    case results
    case aircraft(String)
    case compare
    case request(String)
}

enum AirportRole: Hashable {
    case origin
    case destination
}

@MainActor
@Observable
final class SearchViewModel {
    var origin: Airport?
    var destination: Airport?
    var departureDate: Date
    var passengers: Int = 4
    var pets: Bool = false
    var wifiPreferred: Bool = true
    var golf: Bool = false
    var skis: Bool = false
    var baggage: Bool = false
    var flexibleDays: Int = 0
    var nearbyAirports: Bool = false

    var results: [SearchResult] = []
    var isSearching = false
    var errorMessage: String?
    var compareIDs: [String] = []

    var pickerRole: AirportRole?
    var airportQuery = ""
    var airportMatches: [Airport] = []
    var isLoadingAirports = false

    var path = NavigationPath()

    private let client: any KoriaClient
    private let catalog: MockCatalog

    init(client: any KoriaClient, catalog: MockCatalog) {
        self.client = client
        self.catalog = catalog
        var date = Calendar.current.date(byAdding: .day, value: 14, to: Date()) ?? Date()
        date = Calendar.current.date(bySettingHour: 10, minute: 0, second: 0, of: date) ?? date
        self.departureDate = date
        if let austin = catalog.airport(id: "aus") {
            origin = austin
        }
    }

    var canSearch: Bool {
        origin != nil && destination != nil && passengers > 0 && origin?.id != destination?.id
    }

    var query: SearchQuery? {
        guard let origin, let destination else { return nil }
        return SearchQuery(
            originID: origin.id,
            destinationID: destination.id,
            departureDate: departureDate,
            returnDate: nil,
            passengers: passengers,
            pets: pets,
            wifiPreferred: wifiPreferred,
            golf: golf,
            skis: skis,
            baggage: baggage,
            flexibleDays: flexibleDays,
            nearbyAirports: nearbyAirports
        )
    }

    var compareResults: [SearchResult] {
        compareIDs.compactMap { id in results.first(where: { $0.id == id }) }
    }

    func result(id: String) -> SearchResult? {
        results.first(where: { $0.id == id })
    }

    func openPicker(_ role: AirportRole) {
        pickerRole = role
        airportQuery = ""
        airportMatches = Array(catalog.airports.prefix(8))
    }

    func searchAirports() async {
        isLoadingAirports = true
        defer { isLoadingAirports = false }
        do {
            airportMatches = try await client.searchAirports(query: airportQuery)
        } catch {
            airportMatches = catalog.searchAirports(airportQuery)
        }
    }

    func selectAirport(_ airport: Airport) {
        switch pickerRole {
        case .origin: origin = airport
        case .destination: destination = airport
        case .none: break
        }
        pickerRole = nil
    }

    func runSearch() async {
        guard let query else { return }
        isSearching = true
        errorMessage = nil
        defer { isSearching = false }
        do {
            results = try await client.search(query)
            compareIDs = []
            path.append(SearchRoute.results)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleCompare(_ id: String) {
        if let index = compareIDs.firstIndex(of: id) {
            compareIDs.remove(at: index)
        } else if compareIDs.count < 2 {
            compareIDs.append(id)
        } else {
            compareIDs.removeFirst()
            compareIDs.append(id)
        }
    }

    func isCompared(_ id: String) -> Bool {
        compareIDs.contains(id)
    }

    func goToTrips(_ session: AppSession) {
        path = NavigationPath()
        session.selectedTab = .trips
    }
}
