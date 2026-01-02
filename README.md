# Calctopus

A high-performance, cross-platform node-based calculator built with Svelte 5 and Svelte Flow. Calctopus combines the precision of a desktop professional tool with the fluidity needed for mobile use. Like an octopus, it coordinates multiple logic paths seamlessly across any device.

## Tech Stack

The project leverages a "Svelte + Cloudflare" combination for maximum performance and edge deployment.

| Category | Technology | Reason |
| :--- | :--- | :--- |
| **Frontend** | **Svelte 5** (Vite) | Uses Runes syntax ($state) for high-performance reactivity on both desktop and mobile. |
| **UI Engine** | **Svelte Flow** | Optimized for mouse, trackpad, and touch interactions. |
| **Styling** | **UnoCSS** | High-speed styling with Attributify Mode for clean, responsive layouts. |
| **Icons** | **Lucide Svelte** | Modern, consistent SVG icon set. |
| **Logic** | **Math.js** | Advanced math engine for complex formulas and unit conversions. |
| **Feedback** | **Svelte Sonner** | Interactive toast notifications for save/load states. |
| **Utils** | **NanoID** | Generates short, shareable unique identifiers. |
| **Backend** | **Cloudflare Workers** | Global serverless API with instant execution. |
| **Database** | **Cloudflare D1** | Managed SQLite at the edge for persistent storage. |
| **ORM** | **Drizzle ORM** | Type-safe schema management and database access. |

## System Architecture

```mermaid
graph LR
    User -->|Edit/Interact| Canvas[Svelte Flow UI]
    Canvas -->|UnoCSS| Style
    Canvas -->|Logic Processing| Math[Math.js]
    
    User -->|Request Persistence| API[Cloudflare Worker]
    API -->|Generate Key| ID[NanoID]
    API -->|Store State| DB[(Cloudflare D1)]
    
    DB -->|Fetch Data| API
    API -->|Hydrate UI| Canvas