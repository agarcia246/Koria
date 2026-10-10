import SwiftUI

struct PassportView: View {
    @Environment(\.koria) private var koria
    @Environment(AppSession.self) private var session
    @Environment(AppDependencies.self) private var dependencies
    @Environment(AppStore.self) private var store
    @State private var isSaving = false
    @State private var newPassengerName = ""

    var body: some View {
        @Bindable var store = store
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.xl) {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel(text: "Identity")
                    Text("Passport")
                        .font(KoriaFont.display(48))
                        .foregroundStyle(koria.foreground)
                    Text(store.passport.displayName)
                        .font(KoriaFont.sans(18))
                        .foregroundStyle(koria.muted)
                    photoPlaceholder
                }
                .padding(.top, KoriaSpace.sm)

                VStack(alignment: .leading, spacing: KoriaSpace.md) {
                    SectionLabel(text: "Preferences")
                    stepperRow
                    homeAirport
                    aircraftPreferences
                    Toggle("Wi‑Fi", isOn: $store.passport.wifiPreferred)
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.foreground)
                        .tint(koria.accent)
                    Toggle("Pets", isOn: $store.passport.pets)
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.foreground)
                        .tint(koria.accent)
                    Toggle("Golf clubs", isOn: $store.passport.golf)
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.foreground)
                        .tint(koria.accent)
                    Toggle("Skis", isOn: $store.passport.skis)
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.foreground)
                        .tint(koria.accent)
                    KoriaButton(title: "Save preferences", isLoading: isSaving) {
                        Task { await save() }
                    }
                }

                savedPassengers

                pastTrips

                VStack(alignment: .leading, spacing: KoriaSpace.md) {
                    SectionLabel(text: "Stamps")
                    Text("Kept as a record on your profile. Not a game.")
                        .font(KoriaFont.sans(14))
                        .foregroundStyle(koria.muted)
                    ForEach(store.passport.stamps) { stamp in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(stamp.title)
                                .font(KoriaFont.sans(17))
                                .foregroundStyle(koria.muted)
                            Text(stamp.detail)
                                .font(KoriaFont.sans(14))
                                .foregroundStyle(koria.muted.opacity(0.8))
                            KoriaDivider()
                        }
                    }
                }

                KoriaButton(title: "Sign out", style: .ghost) {
                    session.signOut()
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Passport")
                    .koriaLabel()
            }
        }
        .onChange(of: store.passport.wifiPreferred) { _, value in
            dependencies.search.wifiPreferred = value
        }
        .onChange(of: store.passport.pets) { _, value in
            dependencies.search.pets = value
        }
        .onChange(of: store.passport.golf) { _, value in
            dependencies.search.golf = value
        }
        .onChange(of: store.passport.skis) { _, value in
            dependencies.search.skis = value
        }
        .onChange(of: store.passport.typicalPassengers) { _, value in
            dependencies.search.passengers = value
        }
    }

    private var photoPlaceholder: some View {
        ZStack {
            Rectangle()
                .fill(koria.surface)
                .frame(width: 88, height: 88)
            Image(systemName: "person")
                .font(.system(size: 28))
                .foregroundStyle(koria.muted)
        }
        .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
        .accessibilityLabel("Photo placeholder")
    }

    private var stepperRow: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Typical passengers")
                    .font(KoriaFont.sans(16))
                    .foregroundStyle(koria.foreground)
                Text("Used as the default on new searches.")
                    .font(KoriaFont.sans(13))
                    .foregroundStyle(koria.muted)
            }
            Spacer()
            Text("\(store.passport.typicalPassengers)")
                .font(KoriaFont.display(28))
                .foregroundStyle(koria.foreground)
            Button {
                store.passport.typicalPassengers = max(1, store.passport.typicalPassengers - 1)
            } label: {
                Text("–")
                    .foregroundStyle(koria.foreground)
                    .frame(width: 32, height: 32)
                    .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
            }
            Button {
                store.passport.typicalPassengers = min(16, store.passport.typicalPassengers + 1)
            } label: {
                Text("+")
                    .foregroundStyle(koria.foreground)
                    .frame(width: 32, height: 32)
                    .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
            }
        }
    }

    private var homeAirport: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Home airport")
                .font(KoriaFont.sans(16))
                .foregroundStyle(koria.foreground)
            if let id = store.passport.homeAirportID,
               let airport = dependencies.catalog.airport(id: id) {
                Text("\(airport.city)  ·  \(airport.iata)")
                    .font(KoriaFont.sans(15))
                    .foregroundStyle(koria.muted)
            }
        }
    }

    private var aircraftPreferences: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Aircraft preferences")
                .font(KoriaFont.sans(16))
                .foregroundStyle(koria.foreground)
            if store.passport.aircraftPreferences.isEmpty {
                Text("None set")
                    .font(KoriaFont.sans(14))
                    .foregroundStyle(koria.muted)
            } else {
                Text(store.passport.aircraftPreferences.joined(separator: " · "))
                    .font(KoriaFont.sans(14))
                    .foregroundStyle(koria.muted)
            }
        }
    }

    private var savedPassengers: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            SectionLabel(text: "Saved passengers")
            ForEach(store.passport.passengers) { passenger in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(passenger.fullName)
                            .font(KoriaFont.sans(16))
                            .foregroundStyle(koria.foreground)
                        if let weight = passenger.weightLb {
                            Text("\(weight) lb")
                                .font(KoriaFont.sans(13))
                                .foregroundStyle(koria.muted)
                        }
                    }
                    Spacer()
                    Button("Remove") {
                        store.passport.passengers.removeAll { $0.id == passenger.id }
                    }
                    .font(KoriaFont.label(11))
                    .foregroundStyle(koria.muted)
                }
                KoriaDivider()
            }
            HStack {
                TextField("Full name", text: $newPassengerName)
                    .font(KoriaFont.sans(16))
                    .foregroundStyle(koria.foreground)
                Button("Add") {
                    let name = newPassengerName.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !name.isEmpty else { return }
                    store.passport.passengers.append(
                        SavedPassenger(id: "pax-\(UUID().uuidString.prefix(6).lowercased())", fullName: name, dateOfBirth: nil, weightLb: nil)
                    )
                    newPassengerName = ""
                }
                .font(KoriaFont.label(11))
                .foregroundStyle(koria.accent)
            }
            KoriaDivider()
        }
    }

    private var pastTrips: some View {
        let completed = store.trips.filter { $0.status == .completed }
        return VStack(alignment: .leading, spacing: KoriaSpace.md) {
            SectionLabel(text: "Past trips")
            if completed.isEmpty {
                Text("Completed trips will appear here.")
                    .font(KoriaFont.sans(14))
                    .foregroundStyle(koria.muted)
            } else {
                ForEach(completed) { trip in
                    Text("\(trip.origin.city) → \(trip.destination.city)  ·  \(trip.departureDate.koriaMedium)")
                        .font(KoriaFont.sans(15))
                        .foregroundStyle(koria.foreground)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        _ = try? await dependencies.client.updatePassport(store.passport)
    }
}
