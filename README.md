# Commands

Needs Node 22.18+ and Docker.

    npm run install:all
    npm run db          # mongo via docker (or set MONGO_URL to your own)
    npm run seed        # idempotent + deterministic; safe to run twice
    npm run seed:check  # proves seeding twice gives identical data
    npm run dev:api     # http://localhost:4000
    npm run dev:web     # http://localhost:3000
    npm test            # nav model, address/text helpers, frame containment