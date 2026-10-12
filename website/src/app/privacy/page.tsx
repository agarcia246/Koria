import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY_TEXT, PRIVACY_TITLE, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — KORIA",
};

export default function PrivacyPage() {
  return <LegalDocument title={PRIVACY_TITLE} version={TERMS_VERSION} text={PRIVACY_TEXT} />;
}
