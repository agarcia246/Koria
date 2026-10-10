import { Hero } from "@/components/sections/Hero";
import { Positioning } from "@/components/sections/Positioning";
import { Philosophy } from "@/components/sections/Philosophy";
import { Intelligence } from "@/components/sections/Intelligence";
import { TripFirst } from "@/components/sections/TripFirst";
import { KoriaSplit } from "@/components/sections/KoriaSplit";
import { Experience } from "@/components/sections/Experience";
import { Passport } from "@/components/sections/Passport";
import { Destinations } from "@/components/sections/Destinations";
import { Concierge } from "@/components/sections/Concierge";
import { WhyKoria } from "@/components/sections/WhyKoria";
import { Discretion } from "@/components/sections/Discretion";
import { Future } from "@/components/sections/Future";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <Positioning />
      <Philosophy />
      <Intelligence />
      <TripFirst />
      <KoriaSplit />
      <Experience />
      <Passport />
      <Destinations />
      <Concierge />
      <WhyKoria />
      <Discretion />
      <Future />
      <FinalCTA />
      <Footer />
    </main>
  );
}
