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

    /// Runs on every sign-out, whatever caused it.
    @ObservationIgnored var onSignOut: (() -> Void)?

    private static let launchedKey = "session.launched"
    private let auth: any AuthServicing

    var isAuthenticated: Bool { user != nil }
    var isApproved: Bool {
        if AppConfig.useMock { return true }
        return user?.accessStatus == .approved || user?.accessStatus == .invited
    }

    init(auth: any AuthServicing) {
        self.auth = auth
    }

    /// The last known user. Only the session says who is signed in; this adds the
    /// access status, which the session does not carry, until `/me` answers.
    static func cachedUser() -> User? {
        guard let data = KeychainStore.get(KeychainStore.userKey)?.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(User.self, from: data)
    }

    func restore() async {
        defer { isRestored = true }
        // Older builds kept a copy of the access token here.
        KeychainStore.delete(KeychainStore.tokenKey)
        // Keychain items survive deleting the app and UserDefaults do not, so a
        // reinstall would otherwise come back signed in.
        if !UserDefaults.standard.bool(forKey: Self.launchedKey) {
            UserDefaults.standard.set(true, forKey: Self.launchedKey)
            KeychainStore.delete(KeychainStore.userKey)
            try? await auth.signOut()
        }
        guard let restored = await auth.restoreUser() else {
            KeychainStore.delete(KeychainStore.userKey)
            return
        }
        let user = Self.cachedUser().flatMap { $0.id == restored.id ? $0 : nil } ?? restored
        self.user = user
        accessPending = !AppConfig.useMock && user.accessStatus != .approved && user.accessStatus != .invited
    }

    func signIn(user: User) {
        self.user = user
        accessPending = !AppConfig.useMock && user.accessStatus != .approved && user.accessStatus != .invited
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
        signIn(user: MockCatalog.shared.demoUser)
    }

    func signOut() {
        user = nil
        selectedTab = .fly
        accessPending = false
        KeychainStore.delete(KeychainStore.userKey)
        onSignOut?()
        // The SDK session is what restore() reads, so it has to go too.
        let auth = auth
        Task { try? await auth.signOut() }
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
        let useMock = AppConfig.useMock
        let auth: any AuthServicing = useMock ? DemoAuthService() : SupabaseAuthService()
        let session = AppSession(auth: auth)
        let catalog = MockCatalog.shared
        self.store = store
        self.auth = auth
        self.session = session
        self.catalog = catalog
        self.useMock = useMock

        if useMock {
            let client = MockKoriaClient(catalog: catalog, store: store)
            self.client = client
            self.search = SearchViewModel(client: client, catalog: catalog)
        } else {
            let live = LiveKoriaClient(
                baseURL: AppConfig.apiBaseURL,
                tokenProvider: { try await auth.accessToken() },
                tokenRefresher: { try await auth.refreshAccessToken() }
            )
            // Still unauthorized after a refresh means the session is gone. Drop
            // it so RootView shows sign-in instead of every screen failing.
            live.onUnauthorized = { [weak session] in session?.signOut() }
            session.onSignOut = { [weak store] in store?.clearAccountData() }
            self.client = live
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
