import Foundation

protocol AuthServicing: AnyObject {
    func sendOTP(email: String) async throws
    func verifyOTP(email: String, code: String) async throws -> User
    /// The user behind the stored session, or `nil` when there is no usable session.
    func restoreUser() async -> User?
    /// A valid access token, refreshed by the provider when the stored one has
    /// expired. `nil` when there is no session. Throws `KoriaError.unauthorized`
    /// when the session has been rejected, `KoriaError.network` when the refresh
    /// could not be completed.
    func accessToken() async throws -> String?
    /// Refreshes even if the stored token still looks valid. Throws like `accessToken()`.
    func refreshAccessToken() async throws -> String?
    func signOut() async throws
}

@MainActor
final class DemoAuthService: AuthServicing {
    func sendOTP(email: String) async throws {
        _ = email
    }

    func verifyOTP(email: String, code: String) async throws -> User {
        _ = code
        return User(
            id: "user-demo",
            name: "Alex Rivera",
            email: email.isEmpty ? "alex@flykoria.com" : email,
            accessStatus: .approved,
            termsVersionRequired: LegalLinks.version,
            termsAccepted: false
        )
    }

    func restoreUser() async -> User? { AppSession.cachedUser() }

    func accessToken() async throws -> String? { nil }

    func refreshAccessToken() async throws -> String? { nil }

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

    func verifyOTP(email: String, code: String) async throws -> User {
        let response = try await client.auth.verifyOTP(
            email: email,
            token: code,
            type: .email
        )
        guard let session = response.session else {
            throw KoriaError.unauthorized
        }
        return user(from: session, email: email)
    }

    func restoreUser() async -> User? {
        guard let stored = client.auth.currentSession else { return nil }
        do {
            return user(from: try await client.auth.session)
        } catch {
            // Offline with an expired JWT is not signed out: the refresh token
            // may still be good. Only a rejected session goes back to sign-in.
            guard Self.isRejected(error) else { return user(from: stored) }
            try? await client.auth.signOut(scope: .local)
            return nil
        }
    }

    func accessToken() async throws -> String? {
        do {
            return try await client.auth.session.accessToken
        } catch AuthError.sessionMissing {
            return nil
        } catch {
            throw Self.koriaError(for: error)
        }
    }

    func refreshAccessToken() async throws -> String? {
        do {
            return try await client.auth.refreshSession().accessToken
        } catch {
            throw Self.koriaError(for: error)
        }
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }

    private func user(from session: Session, email: String = "") -> User {
        let metaName = session.user.userMetadata["full_name"]?.stringValue
            ?? session.user.email?.components(separatedBy: "@").first
            ?? "Member"
        return User(
            id: session.user.id.uuidString,
            name: metaName,
            email: session.user.email ?? email,
            accessStatus: .requested,
            termsVersionRequired: LegalLinks.version,
            termsAccepted: false
        )
    }

    /// True when Auth refused the session. A failed refresh leaves the session in
    /// storage, so this is the only signal that it is dead. Network failures,
    /// rate limits and server errors say nothing about the session.
    private static func isRejected(_ error: Error) -> Bool {
        switch error as? AuthError {
        case .sessionMissing:
            return true
        case .api(_, _, _, let response):
            return (400...499).contains(response.statusCode) && ![408, 429].contains(response.statusCode)
        default:
            return false
        }
    }

    private static func koriaError(for error: Error) -> KoriaError {
        isRejected(error) ? .unauthorized : .network(error.localizedDescription)
    }
}
#else
@MainActor
final class SupabaseAuthService: AuthServicing {
    func sendOTP(email: String) async throws {
        _ = email
        throw KoriaError.notImplemented
    }

    func verifyOTP(email: String, code: String) async throws -> User {
        _ = (email, code)
        throw KoriaError.notImplemented
    }

    func restoreUser() async -> User? { nil }

    func accessToken() async throws -> String? { nil }

    func refreshAccessToken() async throws -> String? { nil }

    func signOut() async throws {}
}
#endif
