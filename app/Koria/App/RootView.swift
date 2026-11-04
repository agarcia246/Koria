import SwiftUI

struct RootView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(AppSession.self) private var session
    @Environment(AppDependencies.self) private var dependencies

    var body: some View {
        Group {
            if !session.isRestored {
                Color.koriaInk.ignoresSafeArea()
            } else if session.isAuthenticated {
                if session.isApproved {
                    MainTabView()
                } else {
                    AccessPendingView()
                }
            } else {
                AuthView()
            }
        }
        .environment(\.koria, KoriaPalette(colorScheme: colorScheme))
        .tint(Color.koriaChampagne)
        .preferredColorScheme(nil)
        .task {
            await session.restore()
            guard session.isAuthenticated, !dependencies.useMock,
                  let me = try? await dependencies.client.currentUser()
            else { return }
            session.updateAccess(me.accessStatus)
        }
        .animation(KoriaMotion.animation(reduceMotion: reduceMotion), value: session.isAuthenticated)
        .animation(KoriaMotion.animation(reduceMotion: reduceMotion), value: session.isApproved)
    }
}
