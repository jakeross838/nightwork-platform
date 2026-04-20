# Nightwork — Marketing UI Kit

Public-facing site chrome: header, hero, feature grid, pricing, CTA band, footer.

## Files

- `index.html` — full single-page marketing site.
- `Chrome.jsx` — `<PublicHeader>` (white/blur sticky, Start Free Trial CTA) and `<PublicFooter>` (three-column).
- `Sections.jsx` — `<Hero>`, `<Features>` (2×2 zero-gutter grid w/ kicker labels), `<Pricing>` (3-tier with "Most Popular" flag on middle), `<CallToAction>` (solid teal band).

## Visual rules applied

- Hero headline in Century Gothic at 64px, `line-height: 1.05`, tight `-0.02em` letter-spacing.
- Every section leads with a small tracked-uppercase eyebrow label.
- Pricing card shadow only on the highlighted tier: `0 8px 24px -12px rgba(63,88,98,0.25)` + teal border.
- Zero-gutter feature grid uses a 1px border background for the hairlines (no individual card borders).
- CTA band is solid teal; inverted button is white-on-teal with bold uppercase.

## Known gaps

- No testimonial / customer logos section (none exists in the codebase).
- No product screenshots (real app screenshots not available; we did not fabricate).
- Trial banner & org-branding path not represented.
