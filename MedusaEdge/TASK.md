# Task: MedusaEdge

Source instructions:
- https://docs.google.com/document/d/10a716XpAD6zbMcdbDrjwmoRkxxfRUwlk4En8Fy1vgS4/edit
- Local copy: /home/creativecapital/ecommerce/MedusaEdge/docs/source_instructions.txt

## Objective
Set up Medusa locally as the commerce backend foundation for Edge Marketplace Hub, then progress through instruction phases.

## Instruction-aligned phases
1. Foundation
   - VPS setup
   - Medusa install
   - Supabase setup
   - Redis setup
   - Cloudflare setup
   - GitHub deployment flow
   - Environment variables
   - Basic frontend/backend connection
2. Onboarding MVP
3. Commerce MVP
4. Domains + Referrals
5. Product Import + Printify
6. Polish + Launch

## MVP cut line from instructions
- Google login
- Store name
- Template selection
- Instant subdomain
- Basic product entry
- Basic storefront
- Stripe Connect
- 5% platform fee
- Client dashboard
- Domain instructions
- Referral tracking

## First milestone
A client signs up, chooses a store name, and gets a live subdomain storefront automatically.

## Local setup completed in this task
- Created Medusa project workspace:
  - /home/creativecapital/ecommerce/MedusaEdge/edge-marketplace-hub
- Installed dependencies with npm.
- Included Next.js storefront starter under:
  - /home/creativecapital/ecommerce/MedusaEdge/edge-marketplace-hub/apps/storefront

## Notes from verification
- Medusa CLI is available from workspace bin:
  - /home/creativecapital/ecommerce/MedusaEdge/edge-marketplace-hub/node_modules/.bin/medusa
- Dependency stabilization completed:
  - Updated storefront React versions to 19.2.5 to satisfy Medusa UI peer dependencies.
  - Reinstalled workspace dependencies successfully.
- Storefront dev server starts successfully on http://localhost:8000.
- Backend boot now fails only on missing Postgres connectivity (DATABASE_URL/user credentials), which is expected until DB credentials are provisioned.

## Current blockers to complete full local boot
1. Postgres credentials/database for Medusa backend are not provisioned in this environment.
2. Publishable API key must be created from backend admin after DB is online.

## Env scaffolding completed
- Backend env placeholders configured in:
  - /home/creativecapital/ecommerce/MedusaEdge/edge-marketplace-hub/apps/backend/.env
- Storefront env placeholders configured in:
  - /home/creativecapital/ecommerce/MedusaEdge/edge-marketplace-hub/apps/storefront/.env.local
