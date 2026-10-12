/** FAA aircraft registry name search, prefilled with the certificate number on file. */
export function faaRegistryLookupUrl(certificateNumber: string): string {
  const params = new URLSearchParams({ nametxt: certificateNumber });
  return `https://registry.faa.gov/aircraftinquiry/Search/NameResult?${params.toString()}`;
}
