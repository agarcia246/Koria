import SwiftUI

@main
struct KoriaApp: App {
    @State private var dependencies = AppDependencies()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(dependencies)
                .environment(dependencies.session)
                .environment(dependencies.store)
        }
    }
}
