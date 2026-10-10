import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalFlash } from "@/components/portal-flash";
import { safeDecode } from "@/lib/portal/flash";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/portal/actions";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/access", label: "Access" },
  { href: "/admin/operators", label: "Operators" },
  { href: "/admin/bookings", label: "Bookings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/login");

  const rawFlash = (await cookies()).get("portal_error")?.value;
  const flash = rawFlash ? safeDecode(rawFlash) : undefined;

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      <aside className="w-56 border-r border-silver/40 bg-ivory px-4 py-6 shrink-0">
        <p className="font-display text-2xl px-2">KORIA</p>
        <p className="px-2 text-xs text-warm mt-1 uppercase tracking-wide">Admin</p>
        <nav className="mt-8 space-y-1">
          {adminLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block px-2 py-1.5 text-sm text-warm hover:text-ink hover:bg-paper"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-10 px-2">
          <button type="submit" className="text-xs text-warm hover:text-ink">
            Sign out · {profile?.display_name}
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <PortalFlash message={flash} />
        {children}
      </main>
    </div>
  );
}
