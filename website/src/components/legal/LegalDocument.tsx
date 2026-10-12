import Link from "next/link";
import { Footer } from "@/components/layout/Footer";

export function LegalDocument({
  title,
  version,
  text,
}: {
  title: string;
  version: string;
  text: string;
}) {
  return (
    <main className="bg-ink text-ivory">
      <article className="mx-auto max-w-2xl px-5 pb-24 pt-32 md:px-8">
        <p className="label text-champagne">Version {version}</p>
        <h1 className="display mt-4 text-5xl">{title}</h1>
        <p className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-ivory/80">{text}</p>
        <p className="mt-10 text-sm">
          <Link href="/" className="text-ivory/70 underline hover:text-ivory">
            Back to KORIA
          </Link>
        </p>
      </article>
      <Footer />
    </main>
  );
}
