import Foundation

enum AppConfig {
    static var apiBaseURL: URL {
        url(for: "APIBaseURL") ?? URL(string: "http://127.0.0.1:3000")!
    }

    static var supabaseURL: URL {
        url(for: "SupabaseURL") ?? URL(string: "http://127.0.0.1:54321")!
    }

    static var supabaseAnonKey: String {
        string(for: "SupabaseAnonKey") ?? "placeholder-anon-key"
    }

    static var useMock: Bool {
        let raw = (string(for: "UseMock") ?? "YES").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return raw == "YES" || raw == "TRUE" || raw == "1"
    }

    private static func string(for key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func url(for key: String) -> URL? {
        string(for: key).flatMap(URL.init(string:))
    }
}
