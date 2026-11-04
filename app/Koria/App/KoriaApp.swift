import SwiftUI
import os

@main
struct KoriaApp: App {
    @State private var dependencies = AppDependencies()

    init() {
        // Lets a Release build be checked in Console. Only the base URL; never log keys.
        Logger(subsystem: "travel.koria.app", category: "config")
            .notice("API base URL: \(AppConfig.apiBaseURL.absoluteString, privacy: .public)")
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(dependencies)
                .environment(dependencies.session)
                .environment(dependencies.store)
        }
    }
}
