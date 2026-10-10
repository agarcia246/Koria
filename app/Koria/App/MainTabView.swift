import SwiftUI

struct MainTabView: View {
    @Environment(\.koria) private var koria
    @Environment(AppSession.self) private var session
    @Environment(AppDependencies.self) private var dependencies

    var body: some View {
        @Bindable var session = session
        @Bindable var search = dependencies.search
        TabView(selection: $session.selectedTab) {
            NavigationStack(path: $search.path) {
                SearchHomeView()
            }
            .tag(KoriaTab.fly)
            .tabItem { Label(KoriaTab.fly.title, systemImage: "arrow.up.right") }

            EmptyLegsView()
            .tag(KoriaTab.empty)
            .tabItem { Label(KoriaTab.empty.title, systemImage: "airplane") }

            NavigationStack {
                TripsInboxView()
            }
            .tag(KoriaTab.trips)
            .tabItem { Label(KoriaTab.trips.title, systemImage: "list.bullet") }

            NavigationStack {
                PassportView()
            }
            .tag(KoriaTab.passport)
            .tabItem { Label(KoriaTab.passport.title, systemImage: "person") }
        }
        .tint(koria.accent)
        .toolbarBackground(koria.background, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .environment(dependencies.search)
    }
}
