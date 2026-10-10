import SwiftUI

struct SearchHomeView: View {
    @Environment(\.koria) private var koria
    @Environment(SearchViewModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showDate = false

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: KoriaSpace.xl) {
                header
                composer
                preferences
                if let errorMessage = model.errorMessage {
                    Text(errorMessage)
                        .font(KoriaFont.sans(14))
                        .foregroundStyle(koria.muted)
                }
                KoriaButton(
                    title: "Search",
                    isLoading: model.isSearching,
                    isEnabled: model.canSearch
                ) {
                    Task { await model.runSearch() }
                }
            }
            .padding(.horizontal, KoriaSpace.lg)
            .padding(.top, KoriaSpace.md)
            .padding(.bottom, KoriaSpace.xxl)
        }
        .koriaScreenBackground()
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                KoriaMark()
                    .frame(width: 22, height: 22)
                    .foregroundStyle(koria.foreground)
            }
        }
        .toolbarBackground(koria.background, for: .navigationBar)
        .navigationDestination(for: SearchRoute.self) { route in
            switch route {
            case .results:
                SearchResultsView()
            case .aircraft(let id):
                AircraftDetailView(resultID: id)
            case .compare:
                CompareView()
            case .request(let id):
                TripRequestView(context: .search(aircraftID: id))
            }
        }
        .sheet(item: Binding(
            get: { model.pickerRole.map(IdentifiedRole.init) },
            set: { model.pickerRole = $0?.role }
        )) { _ in
            AirportPickerView()
                .environment(model)
                .environment(\.koria, koria)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $showDate) {
            DatePickerSheet(date: $model.departureDate)
                .environment(\.koria, koria)
                .presentationDetents([.medium, .large])
        }
        .animation(KoriaMotion.animation(reduceMotion: reduceMotion), value: model.origin?.id)
        .animation(KoriaMotion.animation(reduceMotion: reduceMotion), value: model.destination?.id)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel(text: "Private travel")
            Text("You start\nwith a trip.")
                .font(KoriaFont.display(48))
                .foregroundStyle(koria.foreground)
                .lineSpacing(-2)
        }
        .padding(.top, KoriaSpace.sm)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            ComposerRow(label: "From") {
                airportButton(model.origin, placeholder: "City or airport") {
                    model.openPicker(.origin)
                }
            }
            ComposerRow(label: "To") {
                airportButton(model.destination, placeholder: "Where are you going?") {
                    model.openPicker(.destination)
                }
            }
            ComposerRow(label: "When") {
                Button {
                    showDate = true
                } label: {
                    Text(model.departureDate.koriaDateTime)
                        .font(KoriaFont.display(32))
                        .foregroundStyle(koria.foreground)
                }
                .accessibilityLabel("Departure \(model.departureDate.koriaDateTime)")
            }
            ComposerRow(label: "Who") {
                HStack {
                    Text("\(model.passengers)")
                        .font(KoriaFont.display(32))
                        .foregroundStyle(koria.foreground)
                    Text(model.passengers == 1 ? "passenger" : "passengers")
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.muted)
                    Spacer()
                    passengerStepper
                }
            }
        }
    }

    private var passengerStepper: some View {
        HStack(spacing: 18) {
            Button {
                model.passengers = max(1, model.passengers - 1)
            } label: {
                Text("–")
                    .font(KoriaFont.sans(22, weight: .medium))
                    .foregroundStyle(koria.foreground)
                    .frame(width: 36, height: 36)
                    .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
            }
            .accessibilityLabel("Fewer passengers")
            Button {
                model.passengers = min(16, model.passengers + 1)
            } label: {
                Text("+")
                    .font(KoriaFont.sans(22, weight: .medium))
                    .foregroundStyle(koria.foreground)
                    .frame(width: 36, height: 36)
                    .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
            }
            .accessibilityLabel("More passengers")
        }
    }

    private var preferences: some View {
        VStack(alignment: .leading, spacing: KoriaSpace.md) {
            SectionLabel(text: "What's important")
            toggle("Wi‑Fi", Binding(get: { model.wifiPreferred }, set: { model.wifiPreferred = $0 }))
            toggle("Pets", Binding(get: { model.pets }, set: { model.pets = $0 }))
            toggle("Golf clubs", Binding(get: { model.golf }, set: { model.golf = $0 }))
            toggle("Skis", Binding(get: { model.skis }, set: { model.skis = $0 }))
            toggle("Baggage", Binding(get: { model.baggage }, set: { model.baggage = $0 }))
            toggle("Nearby airports", Binding(get: { model.nearbyAirports }, set: { model.nearbyAirports = $0 }))

            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Flexible dates")
                        .font(KoriaFont.sans(16))
                        .foregroundStyle(koria.foreground)
                    Text(model.flexibleDays == 0 ? "Exact date" : "± \(model.flexibleDays) day\(model.flexibleDays == 1 ? "" : "s")")
                        .font(KoriaFont.sans(13))
                        .foregroundStyle(koria.muted)
                }
                Spacer()
                HStack(spacing: 14) {
                    Button {
                        model.flexibleDays = max(0, model.flexibleDays - 1)
                    } label: {
                        Text("–")
                            .foregroundStyle(koria.foreground)
                            .frame(width: 32, height: 32)
                            .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
                    }
                    Text("\(model.flexibleDays)")
                        .font(KoriaFont.sans(16, weight: .medium))
                        .foregroundStyle(koria.foreground)
                        .frame(minWidth: 20)
                    Button {
                        model.flexibleDays = min(7, model.flexibleDays + 1)
                    } label: {
                        Text("+")
                            .foregroundStyle(koria.foreground)
                            .frame(width: 32, height: 32)
                            .overlay(Rectangle().stroke(koria.hairline, lineWidth: 1))
                    }
                }
            }
        }
    }

    private func toggle(_ title: String, _ binding: Binding<Bool>) -> some View {
        Toggle(isOn: binding) {
            Text(title)
                .font(KoriaFont.sans(16))
                .foregroundStyle(koria.foreground)
        }
        .tint(koria.accent)
    }

    private func airportButton(_ airport: Airport?, placeholder: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(airport?.city ?? placeholder)
                    .font(KoriaFont.display(32))
                    .foregroundStyle(airport == nil ? koria.muted : koria.foreground)
                if let airport {
                    Text(airport.secondaryLabel)
                        .font(KoriaFont.sans(13))
                        .foregroundStyle(koria.muted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityLabel(airport.map { "\($0.city), \($0.iata)" } ?? placeholder)
    }
}

private struct IdentifiedRole: Identifiable {
    var role: AirportRole
    var id: AirportRole { role }
}

struct DatePickerSheet: View {
    @Binding var date: Date
    @Environment(\.koria) private var koria
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: KoriaSpace.lg) {
                DatePicker("Date", selection: $date, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.graphical)
                    .tint(koria.accent)
                    .padding(.horizontal)
                Spacer()
            }
            .navigationTitle("When")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(koria.foreground)
                }
            }
            .koriaScreenBackground()
        }
    }
}
