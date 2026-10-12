import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS_TEXT, TERMS_TITLE, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — KORIA",
};

export default function TermsPage() {
  return <LegalDocument title={TERMS_TITLE} version={TERMS_VERSION} text={TERMS_TEXT} />;
}
