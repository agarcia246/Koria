import Foundation

struct MockCatalog: Sendable {
    let airports: [Airport]
    let models: [AircraftModel]
    let amenities: [Amenity]
    let operators: [OperatorProfile]
    let aircraft: [OperatorAircraft]
    let emptyLegs: [EmptyLeg]
    let demoUser: User
    let demoPassport: PassportProfile

    static let shared = MockCatalog()

    var listings: [AircraftListing] {
        aircraft.compactMap(listing(for:))
    }

    func listing(for aircraft: OperatorAircraft) -> AircraftListing? {
        guard
            let model = models.first(where: { $0.id == aircraft.modelID }),
            let operatorProfile = operators.first(where: { $0.id == aircraft.operatorID })
        else { return nil }
        let fitted = self.amenities.filter { aircraft.amenityIDs.contains($0.id) }
        return AircraftListing(
            aircraft: aircraft,
            model: model,
            operatorProfile: operatorProfile,
            amenities: fitted
        )
    }

    func listing(id: String) -> AircraftListing? {
        aircraft.first(where: { $0.id == id }).flatMap(listing(for:))
    }

    func airport(id: String) -> Airport? {
        airports.first(where: { $0.id == id })
    }

    func searchAirports(_ query: String) -> [Airport] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else {
            return Array(airports.prefix(8))
        }
        return airports
            .map { airport -> (Airport, Int) in
                var score = 0
                if airport.city.lowercased().hasPrefix(trimmed) { score += 100 }
                if airport.iata.lowercased() == trimmed { score += 120 }
                if airport.icao.lowercased() == trimmed { score += 110 }
                if airport.iata.lowercased().hasPrefix(trimmed) { score += 80 }
                if airport.searchBlob.contains(trimmed) { score += 20 }
                return (airport, score)
            }
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }

    init() {
        amenities = [
            Amenity(id: "wifi", name: "Starlink Wi‑Fi", kind: .wifi),
            Amenity(id: "ife", name: "Cabin entertainment", kind: .entertainment),
            Amenity(id: "lav", name: "Enclosed lavatory", kind: .lavatory),
            Amenity(id: "galley", name: "Full galley", kind: .galley),
            Amenity(id: "pets", name: "Pets in cabin", kind: .pets),
            Amenity(id: "ski", name: "Ski / golf capability", kind: .ski),
            Amenity(id: "beds", name: "Divan / berthing", kind: .beds),
            Amenity(id: "shower", name: "Shower", kind: .shower),
            Amenity(id: "conf", name: "Conference grouping", kind: .conference)
        ]

        airports = [
            Airport(id: "aus", icao: "KAUS", iata: "AUS", name: "Austin-Bergstrom", city: "Austin", region: "Texas", country: "USA", timeZone: "America/Chicago", latitude: 30.1945, longitude: -97.6699),
            Airport(id: "sjd", icao: "MMSD", iata: "SJD", name: "Los Cabos", city: "Cabo", region: "Baja California Sur", country: "Mexico", timeZone: "America/Mazatlan", latitude: 23.1518, longitude: -109.721),
            Airport(id: "ase", icao: "KASE", iata: "ASE", name: "Aspen/Pitkin County", city: "Aspen", region: "Colorado", country: "USA", timeZone: "America/Denver", latitude: 39.2232, longitude: -106.869),
            Airport(id: "teb", icao: "KTEB", iata: "TEB", name: "Teterboro", city: "New York", region: "New Jersey", country: "USA", timeZone: "America/New_York", latitude: 40.8501, longitude: -74.0608),
            Airport(id: "vny", icao: "KVNY", iata: "VNY", name: "Van Nuys", city: "Los Angeles", region: "California", country: "USA", timeZone: "America/Los_Angeles", latitude: 34.2098, longitude: -118.49),
            Airport(id: "mia", icao: "KMIA", iata: "MIA", name: "Miami International", city: "Miami", region: "Florida", country: "USA", timeZone: "America/New_York", latitude: 25.7959, longitude: -80.2870),
            Airport(id: "pbi", icao: "KPBI", iata: "PBI", name: "Palm Beach", city: "Palm Beach", region: "Florida", country: "USA", timeZone: "America/New_York", latitude: 26.6832, longitude: -80.0956),
            Airport(id: "las", icao: "KLAS", iata: "LAS", name: "Harry Reid", city: "Las Vegas", region: "Nevada", country: "USA", timeZone: "America/Los_Angeles", latitude: 36.0840, longitude: -115.1537),
            Airport(id: "fab", icao: "EGLF", iata: "FAB", name: "Farnborough", city: "London", region: "England", country: "United Kingdom", timeZone: "Europe/London", latitude: 51.2758, longitude: -0.7763),
            Airport(id: "nce", icao: "LFMN", iata: "NCE", name: "Nice Côte d'Azur", city: "Nice", region: "Provence-Alpes-Côte d'Azur", country: "France", timeZone: "Europe/Paris", latitude: 43.6584, longitude: 7.2179),
            Airport(id: "ibz", icao: "LEIB", iata: "IBZ", name: "Ibiza", city: "Ibiza", region: "Balearic Islands", country: "Spain", timeZone: "Europe/Madrid", latitude: 38.8729, longitude: 1.3731),
            Airport(id: "dxb", icao: "OMDB", iata: "DXB", name: "Dubai International", city: "Dubai", region: "Dubai", country: "UAE", timeZone: "Asia/Dubai", latitude: 25.2532, longitude: 55.3657),
            Airport(id: "nas", icao: "MYNN", iata: "NAS", name: "Lynden Pindling", city: "Nassau", region: "New Providence", country: "Bahamas", timeZone: "America/Nassau", latitude: 25.0390, longitude: -77.4662),
            Airport(id: "hnd", icao: "RJTT", iata: "HND", name: "Haneda", city: "Tokyo", region: "Tokyo", country: "Japan", timeZone: "Asia/Tokyo", latitude: 35.5494, longitude: 139.7798),
            Airport(id: "sdl", icao: "KSDL", iata: "SDL", name: "Scottsdale", city: "Scottsdale", region: "Arizona", country: "USA", timeZone: "America/Phoenix", latitude: 33.6229, longitude: -111.911),
            Airport(id: "hpn", icao: "KHPN", iata: "HPN", name: "Westchester County", city: "Westchester", region: "New York", country: "USA", timeZone: "America/New_York", latitude: 41.0670, longitude: -73.7076)
        ]

        models = [
            AircraftModel(id: "phenom300", manufacturer: "Embraer", name: "Phenom 300", category: .light, rangeNM: 2010, cruiseSpeedKTAS: 453, typicalPax: 6, maxPax: 8, cabinLengthFt: 17.2, cabinWidthFt: 5.1, cabinHeightFt: 4.9, baggageCuFt: 76),
            AircraftModel(id: "cj4", manufacturer: "Cessna", name: "Citation CJ4", category: .light, rangeNM: 2165, cruiseSpeedKTAS: 451, typicalPax: 6, maxPax: 8, cabinLengthFt: 17.3, cabinWidthFt: 4.8, cabinHeightFt: 4.8, baggageCuFt: 77),
            AircraftModel(id: "citationx", manufacturer: "Cessna", name: "Citation X", category: .midsize, rangeNM: 3460, cruiseSpeedKTAS: 527, typicalPax: 8, maxPax: 12, cabinLengthFt: 25.2, cabinWidthFt: 5.5, cabinHeightFt: 5.7, baggageCuFt: 82),
            AircraftModel(id: "cl350", manufacturer: "Bombardier", name: "Challenger 350", category: .superMidsize, rangeNM: 3200, cruiseSpeedKTAS: 470, typicalPax: 8, maxPax: 10, cabinLengthFt: 25.2, cabinWidthFt: 7.2, cabinHeightFt: 6.0, baggageCuFt: 106),
            AircraftModel(id: "praetor600", manufacturer: "Embraer", name: "Praetor 600", category: .superMidsize, rangeNM: 4018, cruiseSpeedKTAS: 466, typicalPax: 8, maxPax: 12, cabinLengthFt: 24.1, cabinWidthFt: 6.8, cabinHeightFt: 6.0, baggageCuFt: 155),
            AircraftModel(id: "falcon8x", manufacturer: "Dassault", name: "Falcon 8X", category: .heavy, rangeNM: 6450, cruiseSpeedKTAS: 488, typicalPax: 12, maxPax: 16, cabinLengthFt: 42.7, cabinWidthFt: 7.7, cabinHeightFt: 6.2, baggageCuFt: 140),
            AircraftModel(id: "g450", manufacturer: "Gulfstream", name: "G450", category: .heavy, rangeNM: 4350, cruiseSpeedKTAS: 476, typicalPax: 12, maxPax: 16, cabinLengthFt: 40.4, cabinWidthFt: 7.3, cabinHeightFt: 6.2, baggageCuFt: 169),
            AircraftModel(id: "g650", manufacturer: "Gulfstream", name: "G650", category: .ultraLongRange, rangeNM: 7000, cruiseSpeedKTAS: 516, typicalPax: 13, maxPax: 19, cabinLengthFt: 46.8, cabinWidthFt: 8.2, cabinHeightFt: 6.3, baggageCuFt: 195)
        ]

        operators = [
            OperatorProfile(id: "northline", name: "Northline", code: "NLN", city: "Austin", legalName: "Northline Aviation LLC", dba: "Northline"),
            OperatorProfile(id: "atelier", name: "Atelier Jet", code: "ATJ", city: "Teterboro", legalName: "Atelier Jet Inc.", dba: "Atelier Jet"),
            OperatorProfile(id: "caldera", name: "Caldera", code: "CDA", city: "Van Nuys", legalName: "Caldera Air LLC", dba: "Caldera"),
            OperatorProfile(id: "solstice", name: "Solstice Aviation", code: "SOL", city: "Miami", legalName: "Solstice Aviation Inc.", dba: "Solstice"),
            OperatorProfile(id: "crown", name: "Crown Air", code: "CRN", city: "London", legalName: "Crown Air Ltd", dba: "Crown Air"),
            OperatorProfile(id: "ridge", name: "Atlantic Ridge", code: "ARG", city: "Farnborough", legalName: "Atlantic Ridge Aviation Ltd", dba: "Atlantic Ridge")
        ]

        aircraft = [
            OperatorAircraft(id: "n300nl", tailNumber: "N300NL", operatorID: "northline", modelID: "phenom300", seating: 7, year: 2021, amenityIDs: ["wifi", "lav", "pets"], petPolicy: "Pets in cabin, two carriers.", cabinNotes: "Club four with a belted lav. Quiet, fast light jet for regional work.", homeBaseID: "aus", interiorConfiguration: "Club 7", baggageCuFt: 76, wifi: true, lavatory: true, pets: true, golf: false, skis: false, photoURLs: []),
            OperatorAircraft(id: "n414cj", tailNumber: "N414CJ", operatorID: "caldera", modelID: "cj4", seating: 6, year: 2019, amenityIDs: ["wifi", "lav", "ski"], petPolicy: "Pets by prior approval.", cabinNotes: "High-altitude capable. Strong for mountain airports.", homeBaseID: "vny", interiorConfiguration: "Club 6", baggageCuFt: 77, wifi: true, lavatory: true, pets: false, golf: true, skis: true, photoURLs: []),
            OperatorAircraft(id: "n910xx", tailNumber: "N910XX", operatorID: "atelier", modelID: "citationx", seating: 8, year: 2018, amenityIDs: ["wifi", "ife", "lav", "galley"], petPolicy: "Pets in cabin.", cabinNotes: "The fastest civilian jet in the catalog. Coast-to-coast without compromise.", homeBaseID: "teb", interiorConfiguration: "Club 8", baggageCuFt: 82, wifi: true, lavatory: true, pets: false, golf: false, skis: false, photoURLs: []),
            OperatorAircraft(id: "n350cd", tailNumber: "N350CD", operatorID: "solstice", modelID: "cl350", seating: 9, year: 2022, amenityIDs: ["wifi", "ife", "lav", "galley", "pets", "conf"], petPolicy: "Pets in cabin.", cabinNotes: "Stand-up cabin, conference four, and a proper galley for longer sectors.", homeBaseID: "mia", interiorConfiguration: "Club 9", baggageCuFt: 106, wifi: true, lavatory: true, pets: true, golf: false, skis: false, photoURLs: []),
            OperatorAircraft(id: "n600pr", tailNumber: "N600PR", operatorID: "northline", modelID: "praetor600", seating: 9, year: 2023, amenityIDs: ["wifi", "ife", "lav", "galley", "beds"], petPolicy: "Pets in cabin with notice.", cabinNotes: "Transcontinental range in a super-midsize cabin. Ka-band Wi‑Fi.", homeBaseID: "aus", interiorConfiguration: "Club 9", baggageCuFt: 155, wifi: true, lavatory: true, pets: false, golf: false, skis: false, photoURLs: []),
            OperatorAircraft(id: "g-fdxx", tailNumber: "G-FDXX", operatorID: "ridge", modelID: "falcon8x", seating: 14, year: 2020, amenityIDs: ["wifi", "ife", "lav", "galley", "beds", "pets"], petPolicy: "Pets in cabin.", cabinNotes: "Three-lounge cabin. Quiet, long-legged, and built for overnight Europe.", homeBaseID: "fab", interiorConfiguration: "Club 14", baggageCuFt: 140, wifi: true, lavatory: true, pets: true, golf: false, skis: false, photoURLs: []),
            OperatorAircraft(id: "n450at", tailNumber: "N450AT", operatorID: "atelier", modelID: "g450", seating: 13, year: 2016, amenityIDs: ["wifi", "ife", "lav", "galley", "beds", "ski"], petPolicy: "Pets by arrangement.", cabinNotes: "Forward galley, crew rest, and a cabin that still feels current.", homeBaseID: "teb", interiorConfiguration: "Club 13", baggageCuFt: 169, wifi: true, lavatory: true, pets: false, golf: true, skis: true, photoURLs: []),
            OperatorAircraft(id: "n650cr", tailNumber: "N650CR", operatorID: "crown", modelID: "g650", seating: 14, year: 2021, amenityIDs: ["wifi", "ife", "lav", "galley", "beds", "shower", "pets", "conf"], petPolicy: "Pets in cabin, dedicated handler on request.", cabinNotes: "Ultra-long range. Shower, full berthing, and a cabin designed for the ocean to disappear.", homeBaseID: "fab", interiorConfiguration: "Club 14", baggageCuFt: 195, wifi: true, lavatory: true, pets: true, golf: false, skis: false, photoURLs: [])
        ]

        let modelsCopy = models
        let operatorsCopy = operators
        let amenitiesCopy = amenities
        func makeListing(_ plane: OperatorAircraft) -> AircraftListing? {
            guard
                let model = modelsCopy.first(where: { $0.id == plane.modelID }),
                let operatorProfile = operatorsCopy.first(where: { $0.id == plane.operatorID })
            else { return nil }
            let fitted = amenitiesCopy.filter { plane.amenityIDs.contains($0.id) }
            return AircraftListing(
                aircraft: plane,
                model: model,
                operatorProfile: operatorProfile,
                amenities: fitted
            )
        }
        let listingsByID = Dictionary(uniqueKeysWithValues: aircraft.compactMap { plane in
            makeListing(plane).map { (plane.id, $0) }
        })

        func days(_ offset: Int, hour: Int) -> Date {
            let calendar = Calendar.current
            let base = calendar.date(byAdding: .day, value: offset, to: Date()) ?? Date()
            return calendar.date(bySettingHour: hour, minute: 0, second: 0, of: base) ?? base
        }

        emptyLegs = [
            EmptyLeg(
                id: "eh-teb-pbi",
                listing: listingsByID["n910xx"]!,
                origin: airports.first { $0.id == "teb" }!,
                destination: airports.first { $0.id == "pbi" }!,
                departureDate: days(2, hour: 9),
                seatsAvailable: 8,
                price: PriceOffer(mode: .live, amount: .usd(18_500)),
                notes: "Repositioning south. Live price, same-day confirmation."
            ),
            EmptyLeg(
                id: "eh-vny-ase",
                listing: listingsByID["n350cd"]!,
                origin: airports.first { $0.id == "vny" }!,
                destination: airports.first { $0.id == "ase" }!,
                departureDate: days(5, hour: 11),
                seatsAvailable: 8,
                price: PriceOffer(mode: .live, amount: .usd(14_200)),
                notes: "Mountain-capable crew. Ski bags welcome."
            ),
            EmptyLeg(
                id: "eh-aus-sjd",
                listing: listingsByID["n300nl"]!,
                origin: airports.first { $0.id == "aus" }!,
                destination: airports.first { $0.id == "sjd" }!,
                departureDate: days(3, hour: 14),
                seatsAvailable: 6,
                price: PriceOffer(mode: .live, amount: .usd(9_800)),
                notes: "Friday afternoon empty leg. Light cabin, live price."
            ),
            EmptyLeg(
                id: "eh-fab-nce",
                listing: listingsByID["g-fdxx"]!,
                origin: airports.first { $0.id == "fab" }!,
                destination: airports.first { $0.id == "nce" }!,
                departureDate: days(6, hour: 8),
                seatsAvailable: 12,
                price: PriceOffer(mode: .estimated, amount: .usd(22_000)),
                notes: "European reposition. Estimated until the operator confirms slots."
            ),
            EmptyLeg(
                id: "eh-mia-nas",
                listing: listingsByID["n450at"]!,
                origin: airports.first { $0.id == "mia" }!,
                destination: airports.first { $0.id == "nas" }!,
                departureDate: days(4, hour: 10),
                seatsAvailable: 10,
                price: PriceOffer(mode: .quoteRequired, amount: nil),
                notes: "Island sector. Cabin is available; operator will quote fuel and handling."
            )
        ]

        demoUser = User(id: "user-demo", name: "Alex Rivera", email: "alex@koria.travel", accessStatus: .approved)

        demoPassport = PassportProfile(
            displayName: "Alex Rivera",
            email: "alex@koria.travel",
            photoURL: nil,
            homeAirportID: "aus",
            typicalPassengers: 4,
            pets: false,
            wifiPreferred: true,
            golf: false,
            skis: false,
            aircraftPreferences: ["Light", "Midsize"],
            passengers: [
                SavedPassenger(id: "pax-1", fullName: "Alex Rivera", dateOfBirth: nil, weightLb: 175),
                SavedPassenger(id: "pax-2", fullName: "Sam Rivera", dateOfBirth: nil, weightLb: 140)
            ],
            stamps: [
                PassportStamp(id: "first", title: "First Flight", detail: "The beginning of a private travel identity.", isEarned: false),
                PassportStamp(id: "cities", title: "10 Cities", detail: "A collection, not a coincidence.", isEarned: false),
                PassportStamp(id: "coast", title: "Coast → Coast", detail: "One country, two oceans, no terminals.", isEarned: false),
                PassportStamp(id: "ocean", title: "Transatlantic", detail: "The ocean becomes a corridor.", isEarned: false),
                PassportStamp(id: "island", title: "Island Hopper", detail: "Water, then more water.", isEarned: false)
            ]
        )
    }
}
