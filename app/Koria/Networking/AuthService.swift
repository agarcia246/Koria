import Foundation

protocol AuthServicing: AnyObject {
    func sendOTP(email: String) async throws
    func verifyOTP(email: String, code: String) async throws -> (User, String)
    func signOut() async throws
}

@MainActor
final class DemoAuthService: AuthServicing {
    func sendOTP(email: String) async throws {
        _ = email
    }

    func verifyOTP(email: String, code: String) async throws -> (User, String) {
        _ = code
        let user = User(
            id: "user-demo",
            name: "Alex Rivera",
            email: email.isEmpty ? "alex@koria.travel" : email,
            accessStatus: .approved,
            termsVersionRequired: LegalLinks.version,
            termsAccepted: false
        )
        return (user, "demo-token")
    }

    func signOut() async throws {}
}

#if canImport(Supabase)
import Supabase

@MainActor
final class SupabaseAuthService: AuthServicing {
    private let client: SupabaseClient

    init(url: URL = AppConfig.supabaseURL, anonKey: String = AppConfig.supabaseAnonKey) {
        self.client = SupabaseClient(
            supabaseURL: url,
            supabaseKey: anonKey,
            options: SupabaseClientOptions(
                auth: .init(emitLocalSessionAsInitialSession: true)
            )
        )
    }

    func sendOTP(email: String) async throws {
        try await client.auth.signInWithOTP(email: email)
    }

    func verifyOTP(email: String, code: String) async throws -> (User, String) {
        let response = try await client.auth.verifyOTP(
            email: email,
            token: code,
            type: .email
        )
        guard let session = response.session else {
            throw KoriaError.unauthorized
        }
        let metaName = session.user.userMetadata["full_name"]?.stringValue
            ?? session.user.email?.components(separatedBy: "@").first
            ?? "Member"
        let user = User(
            id: session.user.id.uuidString,
            name: metaName,
            email: session.user.email ?? email,
            accessStatus: .requested,
            termsVersionRequired: LegalLinks.version,
            termsAccepted: false
        )
        return (user, session.accessToken)
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }
}
#else
@MainActor
final class SupabaseAuthService: AuthServicing {
    func sendOTP(email: String) async throws {
        _ = email
        throw KoriaError.notImplemented
    }

    func verifyOTP(email: String, code: String) async throws -> (User, String) {
        _ = (email, code)
        throw KoriaError.notImplemented
    }

    func signOut() async throws {}
}
#endif
