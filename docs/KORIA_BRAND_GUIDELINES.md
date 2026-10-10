# KORIA Brand Design Guidelines

**Version 1.0** · September 2026
Source of truth: `Koria/DesignSystem/` in the native iOS app

---

## 1. Brand essence

KORIA is a premium private aviation marketplace. It does not own aircraft. It connects charter operators with customers, and it should feel like infrastructure for people who already fly privately — not a startup selling the idea of flying.

The product should feel:

- Premium
- Sophisticated
- Minimal but powerful
- Aviation-grade
- Luxury-focused
- Operationally credible

Closest references, adapted for private aviation:

- Apple Wallet
- Linear
- Notion Calendar
- Ramp
- Raycast
- Modern aviation dispatch systems
- High-end hospitality and luxury concierge products

KORIA should communicate **trust, precision, operational reliability, speed, and premium hospitality**.

> Private aviation meets Apple-level product design.

---

## 2. Personality

| Trait | How it shows up |
| --- | --- |
| Calm | Quiet screens. Generous space. No visual noise. |
| Precise | Square corners. Hairline rules. Monospaced digits. ICAO/IATA treated as data, not decoration. |
| Expensive | Champagne accent used sparingly. Serif display type. Warm ivory, never stark white as the default paper. |
| Operational | Status language is literal. Live, Estimated, Quote. Never marketing fluff in operational moments. |
| Hospitable | Headlines are human. “You start with a trip.” Search is city-first, not airport-code-first. |
| Trustworthy | Real operator inventory, real prices, real quotes. No fictional pricing. |

KORIA is never playful, never loud, never crypto, never “disrupting travel.” It is a serious instrument that happens to be beautiful.

---

## 3. Positioning

**What KORIA is**

A private aviation platform connecting charter operators with customers. Aircraft inventory comes from operator partners. The first promise of the brand is a working loop:

`REAL OPERATOR → REAL AIRCRAFT → KORIA DATABASE → CUSTOMER SEARCH → TRIP REQUEST → OPERATOR RESPONSE`

**What KORIA is not**

- An airline
- A fleet owner
- A hackathon prototype
- A generic SaaS dashboard
- A social network for travelers
- A points-and-miles product dressed as luxury

**Tagline (product)**

> Private travel, simplified.

**Supporting line**

> Operators provide the aircraft. KORIA provides the trip.

Use the tagline on authentication, launch, and brand moments. Use the supporting line when explaining the marketplace to operators, press, or new members.

---

## 4. Audiences

The same brand serves two surfaces. They share palette, type, and mark. They do not share density or tone of interaction.

### Customer app (iOS)

Calm, editorial, high-end hospitality. Large display type. Few options, curated. City names before codes. Photography or silhouettes of aircraft, never cartoon jets.

Primary jobs: search a trip, browse aircraft, compare, request, review quotes, discover Empty legs, manage Passport.

### Operator portal

Mission-critical. Dense but readable. Tables, timelines, status systems, keyboard-first workflows. Inspired by dispatch software and Linear, not by the customer app’s editorial scale.

Primary jobs: fleet, amenities, availability, pricing, empty legs, trip requests, accept / counter / decline, bookings.

Do not make the portal look like a consumer lifestyle product. Do not make the customer app look like ops software.

---

## 5. Logo and mark

### Wordmark

**KORIA** is always set in uppercase.

- Product UI wordmark: Instrument Serif, regular, large display sizes (36–64 pt on iOS).
- Marketing lockups may use the same serif. Do not substitute a geometric sans, script, or condensed gothic.
- Never write “Koria” in body marketing headlines when the wordmark is the subject. In running UI copy, sentence case “Koria” is used only for the tab title. Everywhere else the product is **KORIA**.

### The KORIA mark

The mark is a geometric H constructed from three strokes: two verticals and a crossbar that extends past the right stem. It is drawn, not a letterform from a font.

Construction (canonical 40×40 unit grid):

- Left stem: `(9, 6)` → `(9, 34)`
- Right stem: `(31, 6)` → `(31, 34)`
- Crossbar: `(9, 20)` → `(35, 20)` — extends beyond the right stem
- Stroke cap: **square**
- Default stroke: 2.5 units at 40×40

The extending crossbar is the distinctive detail. Do not center the H. Do not round the caps. Do not fill the counters.

### Clear space and minimum size

- Clear space: at least the width of the left stem on all sides.
- Minimum UI size: **22×22 pt** (navigation bar).
- Authentication / hero: **36×36 pt**.
- Print / outdoor: do not go smaller than 8 mm on the short side.

### Color treatments

| Background | Mark / wordmark |
| --- | --- |
| Ivory, Paper, White | Ink `#0A0A0A` |
| Ink, Charcoal | Ivory `#F5F1E8` |
| Photography (dark) | Ivory |
| Photography (light) | Ink |
| Champagne field | Ink only |

Do not place the mark in Champagne as a fill. Do not outline the mark in a second color. Do not add drop shadows, gradients, or a holding shape unless the layout already provides a rectangle (app icon, legal lockup).

### Incorrect use

- Do not rotate, skew, or extrude the mark.
- Do not replace square caps with round caps.
- Do not use the SF Symbol airplane as a logo.
- Do not lock the mark up with a slogan underneath in-product; the wordmark and tagline already do that work on Auth.
- Do not animate the strokes drawing in on every screen. If motion is used, once per session on launch is the maximum.

---

## 6. Color

The palette is a premium monochrome base with a single metallic accent. Warm, not cool. Matte, not glossy.

### Core tokens

| Token | Name | Hex | RGB | Role |
| --- | --- | --- | --- | --- |
| `koriaInk` | Ink | `#0A0A0A` | 10, 10, 10 | Dark canvas, primary text on light |
| `koriaCharcoal` | Charcoal | `#141414` | 20, 20, 20 | Dark surfaces |
| — | Elevated dark | `#181818` | 24, 24, 24 | Cards / raised dark surfaces |
| `koriaIvory` | Ivory | `#F5F1E8` | 245, 241, 232 | Light surfaces, dark text |
| `koriaPaper` | Paper | `#FAFAF7` | 250, 250, 247 | Light canvas |
| — | White | `#FFFFFF` | 255, 255, 255 | Elevated light surfaces only |
| `koriaSilver` | Silver | `#A8A49C` | 168, 164, 156 | Muted text on dark |
| `koriaWarm` | Warm gray | `#6B6660` | 107, 102, 96 | Muted text on light |
| `koriaChampagne` | Champagne | `#C8B88A` | 200, 184, 138 | Accent, live status, selected tint |

Launch background is Ink. System accent color is Champagne.

### Semantic mapping

| Role | Light | Dark |
| --- | --- | --- |
| Background | Paper `#FAFAF7` | Ink `#0A0A0A` |
| Surface | Ivory `#F5F1E8` | Charcoal `#141414` |
| Elevated | White | `#181818` |
| Foreground | Ink | Ivory |
| Muted | Warm gray | Silver |
| Accent | Champagne | Champagne |
| Hairline | Ink at 10% | Ivory at 10% |
| Inverse | Ivory | Ink |
| Inverse foreground | Ink | Ivory |

Hairlines are never a hard gray swatch. They are the foreground color at 10% opacity so they stay in family across themes.

### Accent rules

Champagne is a signal, not a fill.

Use it for:

- Selected tab tint
- Toggle / control tint
- “Live” price mode
- Accented section labels when a value is live or current
- A single interactive text action in a toolbar (e.g. Compare)

Do not use it for:

- Primary buttons (primary buttons are inverted foreground/background)
- Large background fields
- Gradients
- Charts with a rainbow
- Decorative rules under every heading

### What we do not use

- Neon, electric blue, or startup purple
- Crypto black-and-gold foil treatments
- Pure `#000000` as a large fill when Ink is available
- Pure `#FFFFFF` as the app canvas (Paper / Ivory only)
- Semantic rainbow for statuses — statuses are typographic and use Champagne or muted, not red/green/yellow blocks

Warning and destructive moments stay typographic. Decline is a secondary outlined button, not a red fill.

---

## 7. Typography

Two families. One job each.

### Display — Instrument Serif Regular

Editorial, hospitality, destination.

Use for:

- Screen titles (`48` typical, `40–44` on secondary heroes, `64` on Auth wordmark)
- City pairs and airport city names in composers (`32`)
- Dates and passenger counts in the search composer (`32`)
- Empty-state titles (`36`)
- Aircraft names in heroes (`34`)
- Price amounts in the full price lockup (`32`)
- Large numbers that are the subject of the row (typical passengers `28`)

Do not use Instrument Serif for:

- Buttons
- Labels
- Body copy
- Legal
- Tables
- Navigation chrome

Line height: tight. Search home title uses a slightly negative line spacing (`-2`). Allow `minimumScaleFactor` on aircraft names so a long model never wraps awkwardly in a hero.

### Sans — SF Pro (system default)

Operational, body, UI.

| Style | Size | Weight | Use |
| --- | --- | --- | --- |
| Body | 17 | Regular | Cabin notes, primary sentences |
| Body | 16 | Regular | Supporting sentences, form values, toggles |
| Body | 15 | Regular | Secondary facts |
| Caption | 14 | Regular | Helper copy, empty-state messages, operator names |
| Caption | 13 | Regular | Tertiary meta, errors, placeholders |
| Emphasis | 18 / 16 | Medium | Compact prices |
| Label | 12 | Medium | Buttons, toolbar actions |
| Label | 11 | Medium | Section labels (default) |
| Label | 10 | Medium | Status pills |
| Stepper | 22 | Medium | + / – |

Labels are **uppercase**, tracked:

- Section labels: `+2.8`
- Buttons: `+2.4`
- Status pills: `+1.8`

### Hierarchy recipe (customer screens)

1. Optional section label — 11 pt, uppercase, muted or Champagne
2. Display title — Instrument Serif 40–48
3. Supporting sentence — SF 15–16, muted
4. Body / data — SF 16–17, foreground
5. Meta — SF 13–14, muted

### Numerals

Prices and quantitative lockups use **monospaced digits**. Currency is formatted with zero fraction digits (`$42,500`, never `$42500.00`). Quote-required prices display as **On request**, not `$0` or `TBD`.

Aviation units stay abbreviated and lowercase after the number: `nm`, `ktas`, `ft`, `cu ft`, `pax`.

---

## 8. Layout and spacing

Spacing is an 8-point system with one 4-point half-step.

| Token | Value |
| --- | --- |
| `xxs` | 4 |
| `xs` | 8 |
| `sm` | 12 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `xxl` | 48 |
| `hero` | 72 |

### Screen anatomy

- Horizontal inset: `lg` (24)
- Top of scroll content: `sm`–`md`
- Bottom of scroll content: `xxl` (48), so the tab bar never crowds the last action
- Stack spacing between major blocks: `xl` (32) or `lg` (24)
- Card padding: `lg` (24)
- Composer rows: label, 10 pt gap, value, hairline

Screens are **left-aligned**. Do not center marketing-style columns in the customer app except for fully empty canvases that are still written as left-aligned empty states.

### Shape

KORIA is rectangular.

- No rounded-rect buttons
- No pill-shaped primary actions (status “pills” are rectangular with a 1 pt stroke)
- No circular avatars as a brand device
- Cards are flush rectangles in `surface`, no drop shadow
- Dividers are 1 pt hairlines, full width of the content column

Radius, if a platform exception is required (system sheets, date picker): inherit the system. Do not invent a brand corner radius.

### Density

| Surface | Density |
| --- | --- |
| Customer iOS | Editorial. Large type, one primary action, curated lists. |
| Operator portal | High. Tables, filters, timelines. Spacing tokens still apply; type scale compresses. |

---

## 9. Motion

Motion is restrained and functional. It confirms a press or a state change. It never performs.

| Token | Curve | Duration |
| --- | --- | --- |
| Fast | Ease in-out | 200 ms |
| Standard | Ease in-out | 280 ms |
| Slow | Ease in-out | 380 ms |
| Skeleton pulse | Ease in-out, autoreversing | 900 ms |

Press feedback: scale to **0.985** and opacity **0.88**.

Rules:

- Honor Reduce Motion. When it is on, return `nil` animations.
- Do not bounce, spring-overshoot, or use playful interpolations in customer flows.
- Do not parallax the mark.
- Skeleton screens pulse hairline fills. If Reduce Motion is on, hold at 70% opacity with no pulse.
- Auth may hold a dark canvas; do not fade through brand colors on launch beyond a simple cross-fade of the session root.

---

## 10. Iconography

Prefer **SF Symbols**, light/regular weight, aligned to text.

Tab bar (current product):

| Tab | Symbol | Title |
| --- | --- | --- |
| Search | `arrow.up.right` | Koria |
| Empty legs | `airplane` | Empty |
| Trips | `list.bullet` | Trips |
| Passport | `person` | Passport |

Custom drawn marks:

- **KORIA mark** — brand only
- **Aircraft silhouette** — category-aware wing span, used in heroes, filled at 12% of the inverse color on a foreground field

Do not use:

- Cartoon jets, contrails as doodles, or 3D gold airplanes
- Filled colorful icon sets
- Emoji in product chrome
- Illustrated empty states

---

## 11. Components

All customer components live in `Koria/DesignSystem/Components`. New UI should compose these before inventing a one-off.

### Buttons — `KoriaButton`

Full width. Uppercase label. 16 pt vertical padding. 12 pt medium, tracked 2.4.

| Kind | Fill | Label | Stroke |
| --- | --- | --- | --- |
| Primary | Foreground | Inverse | None |
| Secondary | Clear | Foreground | 1 pt hairline |
| Ghost | Clear | Foreground | None |

Disabled: 40% opacity. Loading: label hidden, `ProgressView` in the label color.

Primary is inverted ink/ivory, **not** Champagne. That is what keeps actions feeling like print and metal rather than a consumer CTA.

### Cards — `KoriaCard` / result cards

Surface fill, 24 pt padding, no shadow, no radius. Content left-aligned. A card is a grouping, not a skeuomorphic object.

### Section labels — `SectionLabel`

11 pt, uppercase, tracked 2.8. Muted by default. Champagne when `accented`.

### Status — `StatusPill`

10 pt uppercase, rectangular stroke at 45% of the label color.

| Tone | Color | Use |
| --- | --- | --- |
| Neutral | Muted | Estimated, Quote, generic |
| Accent / Live | Champagne | Live price |
| Warning | Muted | Do not introduce a red pill without a product decision |

### Price lockup — `PriceLockup`

Mode label above the amount. Live mode uses Champagne on the label. Amount in Instrument Serif 32 (or SF medium 18 compact), monospaced digits, trailing aligned when sitting next to an operator name.

### Aircraft hero — `AircraftHero`

220 pt tall. Foreground field. Silhouette in inverse at 12% opacity. Title in display 34, subtitle as a label in inverse at 55%. This is the product’s “photograph” until real photography is available.

### Spec grid

Two columns. Label + value. Aviation specs, never icons for range/speed/cabin.

### Amenity chips

SF 13, hairline rectangle, horizontal 12 / vertical 8. No fill. No checkmarks.

### Composer rows

Label, value, hairline. Used for From / To / When / Who. The value is the destination: city in display 32, IATA and airport name as caption.

### Empty states

Display title + muted body, left aligned. Write them as complete sentences. They should sound like a knowledgeable dispatcher, not an apology from a chatbot.

### Inputs

Text fields are typographic: value, then a hairline. No rounded system field chrome in custom forms. Notes fields can be multiline; placeholders are operational (`Pets, skis, catering, timing`).

---

## 12. Imagery and materials

### Photography (when introduced)

- Real aircraft, real cabins, real FBOs, real sky
- Natural light, slightly desaturated, warm
- Horizon lines level
- People optional and unposed; no champagne-flute stock
- Night ramps and polished aluminum are on-brand; sunset lens flare is not

Treat photography like high-end hospitality, not like a brochure for a fractional program.

### Illustration

Almost none. If a diagram is required (how a trip request moves to an operator), use hairline geometry on Paper/Ink. No isometric startup illustration.

### Materials

Native blur is allowed **carefully** (system bars). Do not build frosted-glass cards. Shadows, if any, are refined and barely visible; the current iOS system uses none on cards. Prefer edge-to-edge color fields.

### Aircraft presentation

Until photography ships, heroes are ink/ivory fields with category-scaled silhouettes. Categories change wing span only — do not invent a different drawing for each OEM.

---

## 13. Voice and tone

KORIA writes like a precise host: short, specific, unimpressed with itself.

### Principles

1. **City first, code second.** Search “Austin → Cabo”, not “KAUS → MMSD”. Codes appear as secondary labels: `ASE · Aspen/Pitkin County`.
2. **Name the mechanism.** “KORIA sends this to the operator.” Not “We’ll take it from here!”
3. **Curate, don’t dump.** “KORIA curated a small set. Not a dump of every tail.”
4. **Operational words for operational states.** Live. Estimated. Quote. Requested. Operator reviewing. Quoted. Countered. Accepted. Declined. Expired.
5. **Hospitality in headlines, discipline in body.** Headlines can break a line for rhythm. Body copy does not.

### Signature lines (canonical)

Use these; do not paraphrase into slogans.

- Private travel, simplified.
- Operators provide the aircraft. KORIA provides the trip.
- You start with a trip.
- Request this trip.
- Aircraft already moving. Live or estimated price, then a request to the operator.
- Earned by flying. Not a feed.

Passport stamps may be slightly more lyrical because they are earned artifacts, not chrome:

- First Koria — The beginning of a private travel identity.
- 10 Cities — A collection, not a coincidence.
- Coast → Coast — One country, two oceans, no terminals.
- Transatlantic — The ocean becomes a corridor.
- Island Hopper — Water, then more water.

### Headlines

Sentence case. Periods on empty-state titles. Line breaks are compositional, not decorative:

```
You start
with a trip.

Request
this trip.

Private travel,
simplified.
```

### Buttons

Uppercase, two to four words, verb-led:

- CONTINUE WITH APPLE
- SEARCH
- REQUEST THIS AIRCRAFT
- REQUEST THIS EMPTY KORIA
- SUBMIT REQUEST
- COMPARE SELECTED
- ACCEPT QUOTE
- DECLINE
- SAVE PREFERENCES
- SIGN OUT

No “Get started”, “Let’s fly”, “Book now”, or emoji.

### Microcopy

| Situation | Write | Don’t write |
| --- | --- | --- |
| No results | No aircraft for this trip. Try another date, fewer passengers, or a closer city pair. | Oops, nothing here ✈️ |
| Empty trips | Nothing requested yet. Start with a trip. | Your journey begins soon |
| Quote required | On request | TBD / Contact us |
| Pricing honesty | Live / Estimated / Quote | From $ / Best price / Instant |
| Errors | Apple Sign In is unavailable here. Continue as demo. | Something went wrong |
| Pets | Pets in cabin | Fur babies welcome |

### Words we own

| Use | Avoid |
| --- | --- |
| KORIA | Koriafy, Koried, the Koria app as a nickname in UI |
| Empty leg / Empty legs | Empty leg as the customer-facing title (allowed in operator/ops copy) |
| Passport | Profile, account home, loyalty club |
| Trip request | Booking request (until it is a booking) |
| Operator | Vendor, partner (in customer UI; “operator partners” is fine in brand narrative) |
| Tail | Plane nickname |
| Member | User (in customer-facing copy) |

**KORIA** is the company and product.
**Koria** is the first tab title only.
**Empty leg** is a repositioning flight listed for customers.
**Passport** is identity and preference, with stamps as a future earned layer — not a social feed.

---

## 14. Data, units, and aviation grammar

Consistency here is part of the brand. Sloppy aviation notation looks amateur.

| Thing | Form | Example |
| --- | --- | --- |
| Route | City → City | Aspen → Cabo |
| Airport secondary | `IATA · Name` | `ASE · Aspen/Pitkin County` |
| Category | Title case, hyphen as specified | Super-Midsize, Ultra-Long Range |
| Aircraft name | Manufacturer + model | Gulfstream G650 |
| Tail | As filed | N650XP |
| Range | Integer + `nm` | 7500 nm |
| Speed | Integer + `ktas` | 488 ktas |
| Cabin | One decimal + `ft` | 46.5 ft |
| Baggage | Integer + `cu ft` | 195 cu ft |
| People | `pax` in meta, “passenger(s)” in sentences | 6 pax · 2 passengers |
| Price | Currency, no cents | $48,500 |
| Date (medium) | System medium date | Sep 18, 2026 |
| Date + time | Product `koriaDateTime` | Keep one formatter; don’t mix 24h and 12h in one screen |
| Middle dots | Two spaces around `·` in UI strings | `Heavy  ·  2021` |

Search must accept city, airport name, IATA, and ICAO. Display prefers city.

---

## 15. Light and dark

Both themes are first-class. Auth is **forced dark** (Ink canvas, Ivory type) as a brand moment. The rest of the app follows the system color scheme.

| | Light | Dark |
| --- | --- | --- |
| Feeling | Warm paper, print catalog | Matte cabin at night |
| Canvas | Paper | Ink |
| Text | Ink | Ivory |
| Accent | Same Champagne | Same Champagne |

Do not invert photography separately from the theme. Do not introduce a third “luxury gold dark mode.” Do not use true black OLED unless replacing Ink after a calibrated review.

Launch / restore screen is Ink regardless of theme, so cold start always matches Auth.

---

## 16. Operator portal (design direction)

The portal shares color, type, and mark. It changes structure.

**Do**

- Dense tables with hairline rows
- Status as text + optional Champagne for live
- Keyboard shortcuts and filters
- Timeline views for availability and trips
- Persistent object names (tail, trip ID, operator code)
- Fast, readable under pressure

**Don’t**

- 48 pt serif page titles on every ops view (reserve display serif for section openers and empty states)
- Lifestyle photography behind dashboards
- Cards-of-cards
- Celebration confetti on accept
- Consumer tab metaphors

If a control would look at home in Linear or a dispatch client, it is closer than if it would look at home in a hotel booking app.

---

## 17. Accessibility

Premium is not an excuse to fail contrast or motion.

- Ivory on Ink and Ink on Ivory are the default text pairs. Champagne is not a body-text color.
- Champagne on Ink/Ivory is for labels and tints; do not set long paragraphs in Champagne.
- Every custom control needs an accessibility label. Price lockups expose “Live price $48,500”, not just the digits.
- Reduce Motion disables press scale, route animations, and skeleton pulses.
- Hit targets for steppers are at least 32–36 pt.
- Dynamic Type: display faces may scale down with `minimumScaleFactor` on heroes; body should reflow.
- Do not convey Live vs Estimated by color alone — the word is always present.

---

## 18. Application examples

### App icon and launch

- Launch background: Ink `#0A0A0A`
- Accent / system tint: Champagne `#C8B88A`
- Icon should be the mark or a severe crop of it, Ivory on Ink. No wordmark on the small icon if the H is legible.

### Authentication

Dark, left aligned, mark 36 pt, **KORIA** at display 64, tagline at display 36 in muted, primary Apple button, ghost demo. Footer supporting line in SF 14 muted. This is the brand in one screen. Do not add a video background.

### Search home

Section label “Private travel”. Display title “You start / with a trip.” Composer in display 32 for destinations, dates, passenger count. One primary Search button. Preferences are toggles with Champagne tint, not chips.

### Results

City pair as display 40. Meta in SF. Short curatorial sentence. Cards with heroes. Compare is an opt-in, two-aircraft action, not a checkbox festival.

### Trip request

Display title “Request / this trip.” Summary as labeled rows. Notes for the operator. One submit.

### Passport

Identity, not a settings dump. Stamps are quiet and locked until earned. No gamification chrome, progress bars, or leaderboards.

---

## 19. Do and don’t

**Do**

- Use Instrument Serif for destinations, titles, and prices
- Use square geometry and hairlines
- Speak in complete, specific sentences
- Show Live / Estimated / Quote honestly
- Leave unused Champagne in the box
- Curate. A small set of aircraft is on-brand.

**Don’t**

- Round the buttons
- Gradient anything
- Introduce a second accent (teal, red, navy)
- Use Inter / Poppins / Montserrat / Playfair as substitutes without a brand review
- Write “book a jet in minutes”
- Fill empty states with illustration
- Treat operators as an afterthought in the visual system — they are the supply

---

## 20. Implementation

SwiftUI tokens are the production source of truth until a separate marketing site ships.

| Guideline | Code |
| --- | --- |
| Colors | `Color.koriaInk` … `Color.koriaChampagne` in `KoriaTheme.swift` |
| Semantic palette | `KoriaPalette` via `EnvironmentValues.koria` |
| Type | `KoriaFont.display`, `.sans`, `.label` |
| Space | `KoriaSpace` |
| Motion | `KoriaMotion` |
| Mark | `KoriaMark` |
| Components | `KoriaComponents.swift` |
| Screen canvas | `.koriaScreenBackground()` |
| Section labels | `.koriaLabel()` / `SectionLabel` |

When adding a screen:

1. Wrap in `.koriaScreenBackground()`
2. Inset horizontally by `KoriaSpace.lg`
3. Title in `KoriaFont.display`
4. Actions through `KoriaButton`
5. Pass `KoriaPalette` into sheets (`.environment(\.koria, koria)`)
6. Tint interactive system controls with `koria.accent`

Marketing, print, and the operator portal should sample these values rather than inventing a parallel palette.

---

## 21. Checklist for new work

- [ ] Does it still feel calm if you remove the accent entirely?
- [ ] Is the primary action inverted ink/ivory, not Champagne?
- [ ] Are labels uppercase, tracked, and muted?
- [ ] Is any price labeled Live, Estimated, or Quote?
- [ ] Are cities shown before codes?
- [ ] Is motion ease-in-out and under 400 ms, with a Reduce Motion path?
- [ ] Would this screen look wrong in a generic fintech app? If not, it is not done.

---

*KORIA Brand Design Guidelines · Internal · Derived from the native design system and product voice. Update this document when tokens in `KoriaTheme.swift` change.*
