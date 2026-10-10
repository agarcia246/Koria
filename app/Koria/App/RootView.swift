import SwiftUI

struct RootView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(AppSession.self) private var session

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
        .onAppear {
            session.restore()
        }
        .animation(KoriaMotion.animation(reduceMotion: reduceMotion), value: session.isAuthenticated)
        .animation(KoriaMotion.animation(reduceMotion: reduceMotion), value: session.isApproved)
    }
}
