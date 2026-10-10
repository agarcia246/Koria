import { KoriaMark } from "@/components/ui/KoriaMark";
import { CONTACT_HREF, INSTAGRAM_HREF, NAV_LINKS } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-ink px-5 pb-10 pt-24 text-ivory md:px-8 lg:px-12">
      <div className="grid gap-16 border-t border-ivory/10 pt-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <KoriaMark className="h-7 w-7" />
            <span className="label tracking-[0.42em]">Koria</span>
          </div>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-silver">
            Private travel, simplified.
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-3 md:col-span-7">
          <div>
            <p className="label mb-5 text-champagne">Explore</p>
            <ul className="space-y-3 text-sm text-ivory/80">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-ivory">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label mb-5 text-champagne">Connect</p>
            <ul className="space-y-3 text-sm text-ivory/80">
              <li>
                <a href={INSTAGRAM_HREF} data-cursor="VIEW">
                  Instagram
                </a>
              </li>
              <li>
                <a href={CONTACT_HREF}>Contact</a>
              </li>
            </ul>
          </div>
          <div>
            <p className="label mb-5 text-champagne">Legal</p>
            <ul className="space-y-3 text-sm text-ivory/80">
              <li>
                <a href="#privacy">Privacy</a>
              </li>
              <li>
                <a href="#terms">Terms</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <p className="label mt-20 text-[0.6rem] tracking-[0.22em] text-silver">
        Built for the way private travel should feel.
      </p>
    </footer>
  );
}
