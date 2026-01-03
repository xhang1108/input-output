# 🐙 Calctopus

**Calctopus** is a high-performance, node-based visual calculator designed for complex calculation workflows. Built with Svelte 5's fine-grained reactivity and migrated to a robust React/Next.js architecture using React Flow, Calctopus provides a seamless and intuitive way to design, visualize, and execute mathematical logic.

## ✨ Key Features

- **Node-Based Interface:** Design calculations visually by connecting nodes.
- **Fine-Grained Reactivity:** Experience instant updates across the entire graph as you change inputs.
- **Specialized Node Types:**
  - **Input Nodes:** Provide raw values or variables.
  - **Math Nodes:** Perform Arithmetic operations (Add, Sub, Mul, Div).
  - **Unary Nodes:** Handle single-input operations (e.g., Negate).
  - **Output Nodes:** Visualize results with real-time tracking.
- **Premium UI:** A sleek, dark-themed interface optimized for both desktop and mobile.
- **Mobile Optimizations:** Built-in virtual keyboard avoidance and touch-friendly controls.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Graph Engine:** [@xyflow/react](https://reactflow.dev/) (React Flow)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **State Management:** React-based dependency tracking for the calculation engine.

## 🚀 Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔮 Future Roadmap

- [ ] **Advanced Math:** Support for trigonometry, powers, and roots.
- [ ] **Logic Gates:** Integration of `if/else` and comparison operators.
- [ ] **Persistence:** Local storage auto-save and cloud sync.
- [ ] **Export Options:** Save your graphs as high-resolution images.

---
Built with ❤️ by the Calctopus Team.
