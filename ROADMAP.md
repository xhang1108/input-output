# Calctopus Development Roadmap

This roadmap outlines the step-by-step plan to build **Calctopus**, a high-performance node-based calculator.

## 📅 Phase 1: Project Initialization & Infrastructure (SvelteKit Unified)
**Goal:** specific single SvelteKit project for both frontend and backend to simplify deployment and schema sharing.

- [ ] **SvelteKit Setup**
    - Initialize SvelteKit project (Vite-based).
    - Configure **Cloudflare Adapter** (`adapter-cloudflare`) for edge deployment.
    - Set up `svelte.config.js` and `vite.config.js`.
- [ ] **Styling & Icons**
    - Install & Configure **UnoCSS** (Attributify mode).
    - Install **Lucide Svelte**.
- [ ] **Database & ORM**
    - Configure **Drizzle ORM** with **Cloudflare D1** within the SvelteKit environment.
    - Define shared schema (accessible to both server endpoints and client types).

## 🧩 Phase 2: Core Frontend Engine (The "Brain")
**Goal:** A working node-based interface using Svelte 5's fine-grained reactivity.

- [ ] **Svelte Flow Integration**
    - Install & setup `@xyflow/svelte` (Svelte Flow).
    - Create a basic canvas.
- [ ] **Node Architecture**
    - Create specialized node components: Input, Math Ops (Add, Sub, Mul, Div), Output.
- [ ] **Logic Engine ($derived.by)**
    - Integrate **Math.js**.
    - **Reactivity:** unique implementation using **`$derived.by`** to manage the dependency graph.
    - Ensure the "Domino Effect": changing an upstream node automatically triggers updates in specific downstream nodes via Svelte's dependency tracking system.

## 💾 Phase 3: Backend & Persistence
**Goal:** Leverage SvelteKit API routes for saving/loading graphs.

- [ ] **Database Schema**
    - Define `graphs` table (id, data, created_at) in Drizzle.
- [ ] **API Implementation (SvelteKit Actions/Endpoints)**
    - `POST /api/save` (or Form Action): Validates JSON, generates **NanoID**, writes to D1.
    - `GET /load/[id]` (Page Load Function): Fetches graph data on the server side (SSR) or API.
- [ ] **User Feedback**
    - Add **Svelte Sonner** for toast notifications on save/load actions.

## 🎨 Phase 4: UI/UX & Mobile Polish
**Goal:** Professional design with specific mobile usage optimizations.

- [ ] **Responsive Design**
    - Optimizing Svelte Flow controls for touch/trackpad.
    - Mobile-friendly sidebar/toolbar.
- [ ] **Mobile Input Handling (Virtual Keyboard)**
    - Implement "Virtual Keyboard Avoidance": Ensure the active node is not obscured when the keyboard opens.
    - Use `visualViewport` API or reactive canvas resizing to adjust layout dynamically during input.
- [ ] **Visual Polish**
    - UnoCSS styling for a premium "Dark Mode" aesthetic.
    - Smooth animations for node connections.

## 🚀 Phase 5: Deployment
**Goal:** One-click deployment to Cloudflare.

- [ ] **Cloudflare Pages Deployment**
    - Deploy the specific SvelteKit app to **Cloudflare Pages**.
    - Ensure Cloudflare D1 binding is correctly linked in production.
- [ ] **Final Checks**
    - Performance audit (Lighthouse).
    - Cross-device testing (Desktop vs. Mobile).
