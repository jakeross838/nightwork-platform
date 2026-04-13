# Ross Command Center

Invoice processing and draw generation platform for Ross Built Custom Homes.

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local
# Fill in your Supabase and Anthropic API keys

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Tech Stack

- **Next.js 14** — App Router, React Server Components
- **TypeScript** — Type safety
- **Tailwind CSS** — Utility-first styling
- **Supabase** — Database, auth, storage
- **Claude API** — AI-powered invoice extraction
