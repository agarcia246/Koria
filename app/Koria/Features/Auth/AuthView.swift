import SwiftUI

struct AuthView: View {
    @Environment(\.koria) private var koria
    @Environment(AppSession.self) private var session
    @Environment(AppDependencies.self) private var dependencies
    @State private var email = ""
    @State private var code = ""
    @State private var sentOTP = false
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var showEarlyAccess = false

    var body: some View {
        ZStack {
            koria.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                Spacer()
                KoriaMark()
                    .frame(width: 36, height: 36)
                    .foregroundStyle(koria.foreground)
                    .padding(.bottom, KoriaSpace.lg)
                Text("KORIA")
                    .font(KoriaFont.display(64))
                    .foregroundStyle(koria.foreground)
                Text("Private travel,\nsimplified.")
                    .font(KoriaFont.display(36))
                    .foregroundStyle(koria.muted)
                    .padding(.top, 12)
                    .padding(.bottom, KoriaSpace.xxl)

                if dependencies.useMock {
                    KoriaButton(title: "Continue with demo") {
                        session.signInDemo()
                    }
                } else {
                    liveAuth
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(KoriaFont.sans(13))
                        .foregroundStyle(koria.muted)
                        .padding(.top, KoriaSpace.md)
                }

                Spacer()
                Text("Operators provide the aircraft.\nKORIA provides the trip.")
                    .font(KoriaFont.sans(14))
                    .foregroundStyle(koria.muted)
                    .padding(.bottom, KoriaSpace.lg)
            }
            .padding(.horizontal, KoriaSpace.lg)
        }
        .preferredColorScheme(.dark)
        .environment(\.koria, KoriaPalette(colorScheme: .dark))
        .sheet(isPresented: $showEarlyAccess) {
            EarlyAccessRequestView()
                .environment(dependencies)
                .environment(session)
                .environment(\.koria, KoriaPalette(colorScheme: .dark))
        }
    }

    private var liveAuth: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .font(KoriaFont.sans(17))
                .foregroundStyle(koria.foreground)
                .padding(.vertical, 8)
            KoriaDivider()

            if sentOTP {
                TextField("Code", text: $code)
                    .keyboardType(.numberPad)
                    .font(KoriaFont.sans(17))
                    .foregroundStyle(koria.foreground)
                    .padding(.vertical, 8)
                KoriaDivider()
                KoriaButton(title: "Verify code", isLoading: isWorking, isEnabled: !code.isEmpty) {
                    Task { await verify() }
                }
            } else {
                KoriaButton(title: "Send code", isLoading: isWorking, isEnabled: !email.isEmpty) {
                    Task { await sendCode() }
                }
            }

            KoriaButton(title: "Request early access", style: .ghost) {
                showEarlyAccess = true
            }
        }
    }

    private func sendCode() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await dependencies.auth.sendOTP(email: email)
            sentOTP = true
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func verify() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let (user, token) = try await dependencies.auth.verifyOTP(email: email, code: code)
            session.signIn(user: user, token: token)
            if let me = try? await dependencies.client.currentUser() {
                session.updateAccess(me.accessStatus)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct EarlyAccessRequestView: View {
    @Environment(\.koria) private var koria
    @Environment(AppDependencies.self) private var dependencies
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var isWorking = false
    @State private var submitted = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                if submitted {
                    Text("Request received")
                        .font(KoriaFont.display(36))
                        .foregroundStyle(koria.foreground)
                    Text("We will be in touch when your access is approved.")
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.muted)
                } else {
                    Text("Request early access")
                        .font(KoriaFont.display(36))
                        .foregroundStyle(koria.foreground)
                    TextField("Name", text: $name)
                        .font(KoriaFont.sans(17))
                        .foregroundStyle(koria.foreground)
                    KoriaDivider()
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .font(KoriaFont.sans(17))
                        .foregroundStyle(koria.foreground)
                    KoriaDivider()
                    if let errorMessage {
                        Text(errorMessage)
                            .font(KoriaFont.sans(13))
                            .foregroundStyle(koria.muted)
                    }
                    KoriaButton(title: "Submit", isLoading: isWorking, isEnabled: !name.isEmpty && !email.isEmpty) {
                        Task { await submit() }
                    }
                }
                Spacer()
            }
            .padding(KoriaSpace.lg)
            .koriaScreenBackground()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(koria.muted)
                }
            }
        }
    }

    private func submit() async {
        isWorking = true
        defer { isWorking = false }
        do {
            try await dependencies.client.requestAccess(email: email, name: name)
            submitted = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct AccessPendingView: View {
    @Environment(\.koria) private var koria
    @Environment(AppSession.self) private var session
    @Environment(AppDependencies.self) private var dependencies
    @State private var isRefreshing = false

    var body: some View {
        ZStack {
            koria.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                Spacer()
                KoriaMark()
                    .frame(width: 28, height: 28)
                    .foregroundStyle(koria.foreground)
                Text("Access pending")
                    .font(KoriaFont.display(44))
                    .foregroundStyle(koria.foreground)
                Text("Your early access request is under review. We will open the app when you are approved.")
                    .font(KoriaFont.sans(16))
                    .foregroundStyle(koria.muted)
                KoriaButton(title: "Check status", isLoading: isRefreshing) {
                    Task { await refresh() }
                }
                KoriaButton(title: "Sign out", style: .ghost) {
                    session.signOut()
                }
                Spacer()
            }
            .padding(.horizontal, KoriaSpace.lg)
        }
        .preferredColorScheme(.dark)
        .environment(\.koria, KoriaPalette(colorScheme: .dark))
    }

    private func refresh() async {
        isRefreshing = true
        defer { isRefreshing = false }
        if let me = try? await dependencies.client.currentUser() {
            session.updateAccess(me.accessStatus)
        }
    }
}
