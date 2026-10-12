import SwiftUI

struct AccountSettingsView: View {
    @Environment(\.koria) private var koria
    @Environment(AppDependencies.self) private var dependencies
    @Environment(AppSession.self) private var session
    @State private var isExporting = false
    @State private var exportFile: ExportFile?
    @State private var showDelete = false
    @State private var confirmation = ""
    @State private var isDeleting = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.xl) {
                Text("Settings")
                    .font(KoriaFont.display(44))
                    .foregroundStyle(koria.foreground)
                Text("Export a copy of your profile, trips, quotes, passengers, invoices, and notifications. Deleting the account removes your name and email and signs you out. Trip, booking, invoice, and payment records stay.")
                    .font(KoriaFont.sans(16))
                    .foregroundStyle(koria.muted)

                KoriaButton(title: "Export data", isLoading: isExporting) {
                    Task { await exportData() }
                }

                KoriaButton(title: "Delete account", style: .ghost) {
                    confirmation = ""
                    errorMessage = nil
                    showDelete = true
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(KoriaFont.sans(14))
                        .foregroundStyle(koria.muted)
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Settings")
                    .koriaLabel()
            }
        }
        .sheet(item: $exportFile) { file in
            ShareLink(item: file.url, preview: SharePreview("KORIA data export", icon: Image(systemName: "doc.text"))) {
                Text("Save or share your export")
                    .font(KoriaFont.sans(16))
                    .padding(KoriaSpace.lg)
            }
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $showDelete) {
            deleteSheet
                .environment(\.koria, koria)
                .presentationDetents([.medium])
        }
    }

    private var deleteSheet: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                Text("Delete account")
                    .font(KoriaFont.display(36))
                    .foregroundStyle(koria.foreground)
                Text("Type DELETE to confirm. This cannot be undone. You will be signed out.")
                    .font(KoriaFont.sans(16))
                    .foregroundStyle(koria.foreground)
                TextField("DELETE", text: $confirmation)
                    .font(KoriaFont.sans(17))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .foregroundStyle(koria.foreground)
                KoriaDivider()
                if let errorMessage {
                    Text(errorMessage)
                        .font(KoriaFont.sans(14))
                        .foregroundStyle(koria.muted)
                }
                KoriaButton(
                    title: "Delete account",
                    style: .ghost,
                    isLoading: isDeleting,
                    isEnabled: confirmation.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == "DELETE"
                ) {
                    Task { await deleteAccount() }
                }
            }
            .padding(KoriaSpace.lg)
        }
        .koriaScreenBackground()
    }

    private func exportData() async {
        isExporting = true
        defer { isExporting = false }
        do {
            let data = try await dependencies.client.exportData()
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("koria-export.json")
            try data.write(to: url, options: .atomic)
            exportFile = ExportFile(url: url)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await dependencies.client.deleteAccount()
            showDelete = false
            session.signOut()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
}
