# KORIA — Native Swift App & System Design Prompt

You are designing the first production-quality version of KORIA, a premium private aviation marketplace and operator infrastructure platform.

This is not a hackathon project, template-heavy SaaS clone, or “vibe-coded” prototype.

The output should feel:

- Premium
- Sophisticated
- Minimal but powerful
- Aviation-grade
- Luxury-focused
- Operationally credible
- Designed by a world-class Apple platform team

Avoid:

- Generic startup UI
- Over-designed dashboards
- Excessive gradients
- Cheap fintech aesthetics
- Template-like admin panels
- Random animations
- Clutter
- AI-generated-looking UX

The product should feel closer to:

- Apple Wallet
- Linear
- Notion Calendar
- Ramp
- Raycast
- Modern aviation dispatch systems
- High-end hospitality brands
- Luxury concierge products

But adapted for private aviation.

The app should communicate:

- Trust
- Precision
- Operational reliability
- Speed
- Premium hospitality
- Modern infrastructure

--------------------------------------------------
PRODUCT OVERVIEW
--------------------------------------------------

KORIA is a private aviation platform connecting charter operators with customers.

KORIA does NOT own aircraft.

Aircraft inventory comes from operator partners.

Operators either:

- Connect their scheduling/inventory systems to KORIA through APIs
OR
- Manage inventory manually through the KORIA Operator Portal

The first major milestone is:

REAL OPERATOR → REAL AIRCRAFT → KORIA DATABASE → CUSTOMER SEARCH → TRIP REQUEST → OPERATOR RESPONSE

This is the foundation of the platform.

--------------------------------------------------
CORE ARCHITECTURE
--------------------------------------------------

Design the system around these components:

1. KORIA CENTRAL DATABASE

PostgreSQL database hosted through Supabase or AWS.

Core entities:

- Users
- Operators
- Aircraft
- Aircraft specifications
- Amenities
- Availability
- Trips
- Quotes
- Bookings
- Empty legs
- Payments/statuses
- KORIA Passport data

This becomes the central source of truth.

2. OPERATOR SYSTEMS

Operators already manage:

- Fleet
- Aircraft schedules
- Aircraft location
- Availability
- Booked trips
- Repositioning flights

KORIA integrates with operator systems through APIs when possible.

Architecture flow:

Operator Scheduling System → API → KORIA

If direct integration is not possible, operators use the KORIA Operator Portal.

3. AIRPORT DATA PROVIDER

KORIA consumes aviation airport data from an external provider.

Required fields:

- IATA codes
- ICAO codes
- Airport names
- City/location
- Coordinates
- Runways
- Time zones
- FBO information

This powers natural airport search.

Users should be able to search:

Austin → Cabo

instead of:

KAUS → MMSD

4. AIRCRAFT MASTER CATALOG

KORIA maintains a standardized aircraft catalog.

Example aircraft model:

Gulfstream G650

Shared specifications:

- Range
- Cabin dimensions
- Passenger capacity
- Baggage capacity
- Aircraft category

Each operator’s actual aircraft attaches to the master model.

Operator-specific aircraft data:

- Seating configuration
- Photos
- Wi‑Fi
- Entertainment
- Lavatory
- Galley
- Pet policy
- Ski/golf capacity
- Additional amenities

This creates consistency across the marketplace.

5. LIVE PRICING MODEL

KORIA does not generate fictional pricing.

Operators can provide:

- LIVE PRICE
- ESTIMATED PRICE
- QUOTE REQUIRED

The customer experience should feel unified regardless of pricing source.

6. EMPTY LEGS / EMPTY LEGS

Operators can publish repositioning flights.

Flow:

Operator API or Operator Portal → KORIA → Customer Discovery

--------------------------------------------------
NATIVE IOS APP REQUIREMENTS
--------------------------------------------------

The customer-facing app should be designed as a premium native iOS experience.

Build using:

- SwiftUI
- Swift
- MVVM or The Composable Architecture (TCA)
- Async/await concurrency
- Modular architecture
- Clean dependency injection
- Production-quality state management

Avoid React Native or hybrid app patterns.

The app should feel like a modern Apple-first product.

Core customer experiences:

- Search flights
- Browse aircraft
- Compare aircraft
- Submit trip requests
- View quotes
- Track booking status
- Discover Empty legs
- Save preferences
- Manage KORIA Passport profile

Design priorities:

- Extremely clean UI
- Fast interactions
- Minimal friction
- Clear hierarchy
- Rich aircraft presentation
- Elegant typography
- Sophisticated spacing system
- Refined motion
- Premium dark/light themes

Search should feel:

- Fast
- Smart
- Predictive
- Aviation-aware

Think:

“Private aviation meets Apple-level product design.”

--------------------------------------------------
OPERATOR PORTAL REQUIREMENTS
--------------------------------------------------

The Operator Portal is mission-critical.

It should feel operationally serious.

Not a generic admin dashboard.

Operators should be able to:

- Add/edit aircraft
- Upload aircraft photos
- Update amenities
- Update availability
- Submit pricing
- Publish empty legs
- Receive trip requests
- Accept/counter/decline requests
- Manage bookings

The portal should feel:

- Fast
- Dense but readable
- Operationally efficient
- Reliable
- Clear under pressure

Use patterns inspired by:

- Airline ops software
- Dispatch systems
- Linear
- Modern enterprise UX

Avoid bloated dashboards.

Focus on:

- Tables
- Timeline views
- Status systems
- Clear workflows
- Keyboard-friendly interactions
- Smart filtering
- Structured information hierarchy

--------------------------------------------------
SWIFT APP ARCHITECTURE
--------------------------------------------------

Design the iOS app architecture with:

- Feature-based modular structure
- Shared design system
- Typed networking layer
- Offline-aware caching strategy
- Reusable API client
- Swift Package Manager modularization
- Authentication/session management
- Secure token storage using Keychain
- Push notification architecture
- Deep linking structure
- Background refresh strategy
- Production analytics/events

Suggested structure:

- Core/
- DesignSystem/
- Features/
- Networking/
- Models/
- Services/
- State/
- Utilities/

Include:

- SwiftUI navigation architecture
- API service layer design
- DTO mapping strategy
- Error handling strategy
- Loading/skeleton states
- Accessibility considerations
- Image caching strategy
- Pagination strategy
- Real-time updates approach

--------------------------------------------------
BACKEND & API REQUIREMENTS
--------------------------------------------------

Design the technical backend architecture for:

OPERATOR APIs
↓
KORIA INTEGRATION LAYER
↓
KORIA BACKEND
↓
POSTGRESQL DATABASE
↓
SWIFT APP

Additional flows:

OPERATOR PORTAL → KORIA BACKEND

AIRPORT DATA PROVIDER → KORIA BACKEND

Include:

- Recommended backend architecture
- Suggested REST or GraphQL API structure
- Suggested service boundaries
- Database schema recommendations
- Authentication strategy
- Multi-tenant operator support
- Availability syncing strategy
- Quote workflow architecture
- Search architecture
- Media storage architecture
- Role/permission models
- Scalability considerations

--------------------------------------------------
TECH STACK PREFERENCES
--------------------------------------------------

Frontend:

- SwiftUI
- Swift
- Combine where appropriate
- Async/await
- Native iOS patterns only

Backend:

- Node.js / TypeScript OR Swift Vapor
- Supabase or AWS
- PostgreSQL

Infrastructure:

- API-first architecture
- Event-driven syncs where appropriate
- Clean domain modeling
- Production-grade engineering standards

Do NOT generate simplistic boilerplate architecture.

Think like a senior Apple platform engineer and staff backend engineer designing a real aviation platform.

--------------------------------------------------
DESIGN SYSTEM DIRECTION
--------------------------------------------------

Visual language:

- Sophisticated typography
- High-contrast layouts
- Precision spacing
- Soft but restrained motion
- Aviation-inspired geometry
- Elegant cards
- Premium monochrome base palette
- Deep charcoal, matte black, warm white, subtle metallic accents

Avoid:

- Neon startup colors
- Crypto aesthetics
- Playful SaaS illustrations
- Cartoon icons
- Excessive glassmorphism

UI should feel:

- Timeless
- Expensive
- Calm
- Intelligent
- Trustworthy

Use:

- Native blur materials carefully
- Refined shadows
- Clean edge-to-edge layouts
- High-end photography
- Minimal but precise animation
- Strong typography hierarchy

--------------------------------------------------
WHAT NEEDS TO BE GENERATED
--------------------------------------------------

Generate:

1. Full iOS app architecture
2. Suggested PostgreSQL schema
3. SwiftUI app structure
4. Operator portal structure
5. API architecture
6. UX flows
7. Navigation structure
8. Design system direction
9. Component strategy
10. Search UX concepts
11. Aircraft detail page concepts
12. Empty leg discovery flow
13. Booking flow
14. Quote management flow
15. Authentication flow
16. State management strategy
17. Folder structure recommendations
18. Reusable SwiftUI component library
19. Backend service architecture
20. MVP implementation roadmap

--------------------------------------------------
MVP IMPLEMENTATION PRIORITY
--------------------------------------------------

Step 1: Create the PostgreSQL database.

Step 2: Define one standardized format for operators, aircraft, amenities, availability, quotes and trips.

Step 3: Build the Operator Portal.

Step 4: Build the API/integration layer.

Step 5: Connect the first real operator.

Step 6: Get aircraft and availability into KORIA.

Step 7: Make inventory searchable from the iOS app.

Step 8: Allow customers to submit trip requests.

Step 9: Send requests to operators.

Step 10: Let operators accept, counter or decline.

Primary objective:

REAL OPERATOR → REAL AIRCRAFT → KORIA DATABASE → CUSTOMER SEARCH → TRIP REQUEST → OPERATOR

Once this infrastructure works reliably, more advanced features can be layered on top:

- KORIA Passport
- AI concierge
- Rewards
- Memberships
- Split booking
- Predictive recommendations
- Premium travel ecosystem features

The final output should feel like a production-ready aviation platform designed by a world-class Apple product and infrastructure team — not a startup prototype or AI-generated demo app.