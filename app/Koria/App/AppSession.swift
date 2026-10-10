import Foundation

enum KoriaTab: String, Hashable, CaseIterable {
    case fly
    case empty
    case trips
    case passport

    var title: String {
        switch self {
        case .fly: "FLY"
        case .empty: "EMPTY"
        case .trips: "TRIPS"
        case .passport: "PASSPORT"
        }
    }
}

@MainActor
@Observable
final class AppSession {
    var user: User?
    var selectedTab: KoriaTab = .fly
    var isRestored = false
    var accessPending = false

    var isAuthenticated: Bool { user != nil }
    var isApproved: Bool {
        if AppConfig.useMock { return true }
        return user?.accessStatus == .approved || user?.accessStatus == .invited
    }

    func restore() {
        defer { isRestored = true }
        guard KeychainStore.get(KeychainStore.tokenKey) != nil,
              let data = KeychainStore.get(KeychainStore.userKey)?.data(using: .utf8),
              let user = try? JSONDecoder().decode(User.self, from: data)
        else { return }
        self.user = user
        accessPending = !AppConfig.useMock && user.accessStatus != .approved && user.accessStatus != .invited
    }

    func signIn(user: User, token: String) {
        self.user = user
        accessPending = !AppConfig.useMock && user.accessStatus != .approved && user.accessStatus != .invited
        KeychainStore.set(token, key: KeychainStore.tokenKey)
        if let data = try? JSONEncoder().encode(user), let raw = String(data: data, encoding: .utf8) {
            KeychainStore.set(raw, key: KeychainStore.userKey)
        }
    }

    func updateAccess(_ status: AccessStatus) {
        guard var user else { return }
        user.accessStatus = status
        self.user = user
        accessPending = status != .approved && status != .invited
        if let data = try? JSONEncoder().encode(user), let raw = String(data: data, encoding: .utf8) {
            KeychainStore.set(raw, key: KeychainStore.userKey)
        }
    }

    func signInDemo() {
        signIn(user: MockCatalog.shared.demoUser, token: "demo-token")
    }

    func signOut() {
        user = nil
        selectedTab = .fly
        accessPending = false
        KeychainStore.delete(KeychainStore.tokenKey)
        KeychainStore.delete(KeychainStore.userKey)
    }
}

@MainActor
@Observable
final class AppDependencies {
    let store: AppStore
    let client: any KoriaClient
    let session: AppSession
    let catalog: MockCatalog
    let search: SearchViewModel
    let auth: any AuthServicing
    let useMock: Bool

    init() {
        let store = AppStore()
        let session = AppSession()
        let catalog = MockCatalog.shared
        let useMock = AppConfig.useMock
        self.store = store
        self.session = session
        self.catalog = catalog
        self.useMock = useMock

        if useMock {
            let client = MockKoriaClient(catalog: catalog, store: store)
            self.client = client
            self.auth = DemoAuthService()
            self.search = SearchViewModel(client: client, catalog: catalog)
        } else {
            let live = LiveKoriaClient(
                baseURL: AppConfig.apiBaseURL,
                tokenProvider: { KeychainStore.get(KeychainStore.tokenKey) }
            )
            self.client = live
            self.auth = SupabaseAuthService()
            self.search = SearchViewModel(client: live, catalog: catalog)
        }

        self.search.passengers = store.passport.typicalPassengers
        self.search.pets = store.passport.pets
        self.search.wifiPreferred = store.passport.wifiPreferred
        self.search.golf = store.passport.golf
        self.search.skis = store.passport.skis
        if let homeID = store.passport.homeAirportID, let home = catalog.airport(id: homeID) {
            self.search.origin = home
        }
    }
}
