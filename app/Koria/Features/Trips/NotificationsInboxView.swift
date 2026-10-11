import SwiftUI

struct NotificationsInboxView: View {
    @Environment(\.koria) private var koria
    @Environment(AppDependencies.self) private var dependencies

    @State private var items: [InboxNotification] = []
    @State private var hasMore = false
    @State private var nextOffset = 0
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var openTrip: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                Text("Notifications")
                    .font(KoriaFont.display(48))
                    .foregroundStyle(koria.foreground)
                    .padding(.top, KoriaSpace.sm)

                if let errorMessage {
                    Text(errorMessage)
                        .font(KoriaFont.sans(14))
                        .foregroundStyle(koria.muted)
                }

                if items.isEmpty && !isLoading {
                    EmptyState(
                        title: "Nothing new.",
                        message: "Quotes, confirmations, and documents will land here."
                    )
                } else {
                    ForEach(items) { item in
                        Button {
                            Task { await open(item) }
                        } label: {
                            NotificationRow(item: item)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if hasMore {
                    Button("Earlier") {
                        Task { await load(reset: false) }
                    }
                    .font(KoriaFont.sans(14))
                    .foregroundStyle(koria.foreground)
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $openTrip) { tripID in
            TripDetailView(tripID: tripID)
        }
        .task {
            await load(reset: true)
        }
    }

    private func load(reset: Bool) async {
        if isLoading { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let offset = reset ? 0 : nextOffset
        do {
            let page = try await dependencies.client.notifications(limit: 20, offset: offset)
            if reset {
                items = page.notifications
            } else {
                let seen = Set(items.map(\.id))
                items.append(contentsOf: page.notifications.filter { !seen.contains($0.id) })
            }
            hasMore = page.hasMore
            nextOffset = page.offset + page.notifications.count
        } catch {
            if reset { items = [] }
            errorMessage = error.localizedDescription
        }
    }

    private func open(_ item: InboxNotification) async {
        if item.readAt == nil, let updated = try? await dependencies.client.markNotificationRead(id: item.id) {
            if let index = items.firstIndex(where: { $0.id == updated.id }) {
                items[index] = updated
            }
        }
        if let tripID = item.tripRequestId {
            openTrip = tripID
        }
    }
}

private struct NotificationRow: View {
    let item: InboxNotification
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.title ?? "Update")
                    .font(KoriaFont.sans(16, weight: .medium))
                    .foregroundStyle(koria.foreground)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: KoriaSpace.sm)
                if item.readAt == nil {
                    Circle()
                        .fill(koria.accent)
                        .frame(width: 8, height: 8)
                        .accessibilityLabel("Unread")
                }
            }
            if let body = item.body, !body.isEmpty {
                Text(body)
                    .font(KoriaFont.sans(14))
                    .foregroundStyle(koria.muted)
                    .multilineTextAlignment(.leading)
            }
            Text(item.createdAt.koriaShort)
                .font(KoriaFont.sans(13))
                .foregroundStyle(koria.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(KoriaSpace.lg)
        .background(koria.surface)
    }
}
