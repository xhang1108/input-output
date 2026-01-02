# Calctopus Development Roadmap

This roadmap outlines the step-by-step plan to build **Calctopus**, a high-performance node-based calculator.

## 📅 Phase 1: Project Initialization & Infrastructure (SvelteKit Unified)
**Goal:** specific single SvelteKit project for both frontend and backend to simplify deployment and schema sharing.

- [x] **SvelteKit Setup**
    - [x] Initialize SvelteKit project (Vite-based).
    - [x] Configure **Cloudflare Adapter** (`adapter-cloudflare`) for edge deployment.
    - [x] Set up `svelte.config.js` and `vite.config.js`.
- [x] **Styling & Icons**
    - [x] Install & Configure **UnoCSS** (Attributify mode).
    - [x] Install **Lucide Svelte**.
- [x] **Database & ORM**
    - [x] Configure **Drizzle ORM** with **Cloudflare D1** within the SvelteKit environment.
    - [x] Define shared schema (`graphs` table).

## 🧩 Phase 2: Core Frontend Engine (The "Brain")
**Goal:** A working node-based interface using Svelte 5's fine-grained reactivity.

- [x] **Svelte Flow Integration**
    - [x] Install & setup `@xyflow/svelte` (Svelte Flow).
    - [x] Create a basic canvas.
- [x] **Node Architecture**
    - [x] Create specialized node components: Input, Math Ops (Add, Sub, Mul, Div), Output.
- [x] **Logic Engine ($derived.by)**
    - [x] Integrate **Math.js** (replaced with native JS for stability).
    - [x] **Reactivity:** unique implementation using **`$derived.by`** to manage the dependency graph.
    - [x] Ensure the "Domino Effect": changing an upstream node automatically triggers updates in specific downstream nodes via Svelte's dependency tracking system.

## 💾 Phase 3: Backend & Persistence
**Goal:** Leverage SvelteKit API routes for saving/loading graphs.

- [x] **Database Schema**
    - [x] Define `graphs` table (id, data, created_at) in Drizzle.
- [x] **API Implementation (SvelteKit Actions/Endpoints)**
    - [x] `POST /api/save` (or Form Action): Validates JSON, generates **NanoID**, writes to D1.
    - [x] `GET /load/[id]` (Page Load Function): Fetches graph data on the server side (SSR) or API.
- [x] **User Feedback**
    - [x] Add **Svelte Sonner** for toast notifications on save/load actions.

## 🎨 Phase 4: UI/UX & Mobile Polish
**Goal:** Professional design with specific mobile usage optimizations.

- [x] **Responsive Design**
    - [x] Optimizing Svelte Flow controls for touch/trackpad.
    - [x] Mobile-friendly sidebar/toolbar.
- [x] **Mobile Input Handling (Virtual Keyboard)**
    - [x] Implement "Virtual Keyboard Avoidance": Ensure the active node is not obscured when the keyboard opens.
    - [x] Use `visualViewport` API or reactive canvas resizing to adjust layout dynamically during input.
- [x] **Visual Polish**
    - [x] UnoCSS styling for a premium "Dark Mode" aesthetic.
    - [x] Smooth animations for node connections.

## 🚀 Phase 5: Deployment (MVP Complete)
**Goal:** Stable deployment for user access.

- [x] **Adapter Migration**
    - [x] Switch to `@sveltejs/adapter-node` for maximum stability with Svelte 5.
- [x] **Production Verification**
    - [x] Verify local production build (`npm run build` + `node build`).
    - [x] Ensure correct rendering of graph engine in production environment.

---

## 🔮 Phase 6: Future Enhancements (Planned)
**Goal:** Advanced mathematical capabilities and enhanced user experience.

- [ ] **Advanced Mathematical Nodes**
    - [ ] Trigonometry (`sin`, `cos`, `tan`).
    - [ ] Powers and Roots (`^`, `sqrt`).
    - [ ] Logic Gates (`if/else`, `>`, `<`).
- [ ] **Local Persistence**
    - [ ] `localStorage` auto-save to prevent data loss on refresh.
    - [ ] Export graph as Image/PNG.
- [ ] **UI/UX 2.0**
    - [ ] Mini-map for navigating large complex graphs.
    - [ ] Customizable grid backgrounds (Dots, Lines, Crosses).
    - [ ] Color-coded nodes (Blue for inputs, Green for math, Red for output).

## 🛠️ Maintenance & Compatibility
**Goal:** Ensure long-term stability and eventual migration back to Cloudflare.

- [ ] **Periodic Checks**
    - [ ] Check `@xyflow/svelte` changelogs for Svelte 5 hydration fixes (monthly).
    - [ ] Check `@sveltejs/adapter-cloudflare` for compatibility updates.
    - [ ] **Experiment:** Try switching back to Clouflare adapter (`npm i -D @sveltejs/adapter-cloudflare`) to test if "blank screen" issue is resolved.
