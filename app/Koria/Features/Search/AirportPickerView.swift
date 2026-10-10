import SwiftUI

struct AirportPickerView: View {
    @Environment(\.koria) private var koria
    @Environment(SearchViewModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Bool

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                TextField("City, IATA, or ICAO", text: $model.airportQuery)
                    .font(KoriaFont.display(28))
                    .foregroundStyle(koria.foreground)
                    .focused($focused)
                    .padding(.horizontal, KoriaSpace.lg)
                    .padding(.vertical, KoriaSpace.md)
                    .submitLabel(.search)
                    .onChange(of: model.airportQuery) { _, _ in
                        Task { await model.searchAirports() }
                    }
                KoriaDivider()
                    .padding(.horizontal, KoriaSpace.lg)
                List(model.airportMatches) { airport in
                    Button {
                        model.selectAirport(airport)
                        dismiss()
                    } label: {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(airport.city)
                                    .font(KoriaFont.sans(18, weight: .medium))
                                    .foregroundStyle(koria.foreground)
                                Text(airport.name)
                                    .font(KoriaFont.sans(13))
                                    .foregroundStyle(koria.muted)
                            }
                            Spacer()
                            Text(airport.iata)
                                .font(KoriaFont.label(12))
                                .tracking(1.6)
                                .foregroundStyle(koria.accent)
                        }
                        .padding(.vertical, 6)
                    }
                    .listRowBackground(koria.background)
                    .listRowSeparatorTint(koria.hairline)
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
            .koriaScreenBackground()
            .navigationTitle(model.pickerRole == .origin ? "From" : "To")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(koria.muted)
                }
            }
            .onAppear {
                focused = true
                Task { await model.searchAirports() }
            }
        }
    }
}
