import Link from "next/link";

export default function AdminHome() {
  return (
    <div>
      <h1 className="font-display text-3xl">Admin</h1>
      <ul className="mt-8 space-y-2 text-sm">
        <li>
          <Link href="/admin/access" className="text-warm hover:text-ink">
            Access requests →
          </Link>
        </li>
        <li>
          <Link href="/admin/operators" className="text-warm hover:text-ink">
            Operators →
          </Link>
        </li>
        <li>
          <Link href="/admin/bookings" className="text-warm hover:text-ink">
            Bookings / mark paid →
          </Link>
        </li>
      </ul>
    </div>
  );
}
