import SwiftUI

enum EmptyRoute: Hashable {
    case detail(String)
    case request(String)
}

struct EmptyLegsView: View {
    @Environment(\.koria) private var koria
    @Environment(AppDependencies.self) private var dependencies
    @Environment(AppSession.self) private var session
    @State private var items: [EmptyLeg] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: KoriaSpace.lg) {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel(text: "Repositioning")
                        Text("Empty legs")
                            .font(KoriaFont.display(44))
                            .foregroundStyle(koria.foreground)
                        Text("Aircraft already moving. Live or estimated price, then a request to the operator.")
                            .font(KoriaFont.sans(15))
                            .foregroundStyle(koria.muted)
                    }
                    .padding(.top, KoriaSpace.sm)

                    if isLoading {
                        SkeletonBlock(height: 160)
                        SkeletonBlock(height: 160)
                    } else if let errorMessage {
                        EmptyState(title: "Empty legs didn't load.", message: errorMessage)
                    } else if items.isEmpty {
                        EmptyState(
                            title: "No empty legs right now.",
                            message: "Operators publish repositioning flights as they appear. Check back, or search a full trip."
                        )
                    } else {
                        ForEach(items) { item in
                            Button {
                                path.append(EmptyRoute.detail(item.id))
                            } label: {
                                EmptyLegCard(item: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, KoriaSpace.lg)
                .padding(.bottom, KoriaSpace.xxl)
            }
            .koriaScreenBackground()
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Empty")
                        .koriaLabel()
                }
            }
            .navigationDestination(for: EmptyRoute.self) { route in
                switch route {
                case .detail(let id):
                    EmptyLegDetailView(emptyLegID: id, path: $path)
                case .request(let id):
                    TripRequestView(context: .empty(emptyLegID: id))
                }
            }
        }
        .task {
            await load()
        }
        .onChange(of: session.selectedTab) { _, tab in
            if tab != .empty {
                path = NavigationPath()
            }
        }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let legs = try await dependencies.client.emptyLegs()
            items = legs
            dependencies.store.emptyLegs = legs
        } catch {
            if dependencies.useMock {
                items = dependencies.catalog.emptyLegs
                dependencies.store.emptyLegs = items
            } else {
                items = []
                dependencies.store.emptyLegs = []
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct EmptyLegCard: View {
    let item: EmptyLeg
    @Environment(\.koria) private var koria

    var body: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            HStack {
                Text(item.departureDate.koriaDateTime)
                    .koriaLabel()
                Spacer()
                StatusPill(text: item.price.mode.label, tone: item.price.mode == .live ? .live : .neutral)
            }
            Text("\(item.origin.city) → \(item.destination.city)")
                .font(KoriaFont.display(30))
                .foregroundStyle(koria.foreground)
            Text("\(item.listing.model.displayName)  ·  \(item.seatsAvailable) seats")
                .font(KoriaFont.sans(14))
                .foregroundStyle(koria.muted)
            HStack {
                Text(item.listing.operatorProfile.name)
                    .font(KoriaFont.sans(13))
                    .foregroundStyle(koria.muted)
                Spacer()
                Text(item.price.displayAmount)
                    .font(KoriaFont.sans(16, weight: .medium))
                    .foregroundStyle(koria.foreground)
            }
            Text("View")
                .koriaLabel(koria.accent)
        }
        .padding(KoriaSpace.lg)
        .background(koria.surface)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.origin.city) to \(item.destination.city), \(item.listing.model.displayName), \(item.departureDate.koriaMedium), \(item.price.accessibilityLabel)")
    }
}

@MainActor
func emptyLeg(id: String, dependencies: AppDependencies) -> EmptyLeg? {
    if let stored = dependencies.store.emptyLegs.first(where: { $0.id == id }) {
        return stored
    }
    guard dependencies.useMock else { return nil }
    return dependencies.catalog.emptyLegs.first { $0.id == id }
}

struct EmptyLegDetailView: View {
    let emptyLegID: String
    @Binding var path: NavigationPath
    @Environment(\.koria) private var koria
    @Environment(AppDependencies.self) private var dependencies

    var body: some View {
        Group {
            if let item = emptyLeg(id: emptyLegID, dependencies: dependencies) {
                content(item)
            } else {
                EmptyState(title: "This empty leg is gone.", message: "It may have been booked or withdrawn.")
                    .padding(KoriaSpace.lg)
            }
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Empty leg")
                    .koriaLabel()
            }
        }
    }

    private func content(_ item: EmptyLeg) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                AircraftHero(
                    category: item.listing.model.category,
                    title: "\(item.origin.city) → \(item.destination.city)",
                    subtitle: item.listing.model.displayName
                )
                VStack(alignment: .leading, spacing: KoriaSpace.xl) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.listing.operatorProfile.name)
                                .koriaLabel()
                            Text(item.departureDate.koriaDateTime)
                                .font(KoriaFont.sans(16))
                                .foregroundStyle(koria.foreground)
                        }
                        Spacer()
                        PriceLockup(offer: item.price)
                    }
                    Text(item.notes)
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.muted)
                    SpecGrid(items: [
                        SpecItem(id: "seats", label: "Seats open", value: "\(item.seatsAvailable)"),
                        SpecItem(id: "tail", label: "Tail", value: item.listing.aircraft.tailNumber),
                        SpecItem(id: "from", label: "From", value: "\(item.origin.iata) · \(item.origin.name)"),
                        SpecItem(id: "to", label: "To", value: "\(item.destination.iata) · \(item.destination.name)")
                    ])
                    KoriaButton(title: "Request this trip") {
                        path.append(EmptyRoute.request(item.id))
                    }
                }
                .padding(KoriaSpace.lg)
            }
        }
    }
}
