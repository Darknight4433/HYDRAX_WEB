# 💧 HYDRAX — AI-Powered Water Monitoring & Valve Control System

[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android_8.5-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Realtime_IoT-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)

**HYDRAX** is an enterprise-grade IoT water management platform engineered for institutional water monitoring, predictive leak detection, automated shutoff control, and real-time consumption analytics.

---

## 🌟 Key Features

- **📊 Overview Dashboard**: Real-time aggregate water consumption, IoT fleet health, node status, and live telemetry stream.
- **🚰 Node Management**: Detailed status, pressure levels, flow rates, and valve actuation for individual IoT nodes across facilities.
- **📈 Advanced Analytics**: Historical consumption trends, anomaly detection, pressure variance analysis, and leak incident logging.
- **⚡ Remote Valve Control**: Real-time automated and manual remote valve open/close actuation with fail-safe status verification.
- **🚨 Dynamic Thresholds & Alerts**: Configurable pressure and flow triggers with instant notifications and automated shutoff protection.
- **📱 Android Native App Support**: Bundled with Capacitor for Android deployment, including in-app APK download capability, native safe-area header clearance, and mobile-optimized bottom navigation.

---

## 🛠️ Tech Stack

- **Frontend & Routing**: React 19, TanStack Router, TanStack Start
- **Build Tool**: Vite 8 with TypeScript
- **Styling**: Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Glassmorphic UI Design
- **Data Visualization**: Recharts, TanStack Query
- **Mobile Runtime**: Capacitor 8 (Android)
- **IoT & Backend**: Firebase Realtime Sync

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm, yarn, or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/Darknight4433/HYDRAX_WEB.git
cd HYDRAX_WEB

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

---

## 📱 Mobile (Android) Workflow

HYDRAX includes full native mobile support via Capacitor:

```bash
# Sync web build to native Android project
npm run android:sync

# Build native debug APK directly
npm run android:build

# Open project in Android Studio
npm run android:open
```

The generated APK is also hosted locally under `/public/hydrax.apk` for direct in-browser download.

---

## 📁 Project Structure

```text
hydrax-aqua-ai/
├── android/            # Native Android Capacitor wrapper project
├── public/             # Static assets, icons, and prebuilt APK
├── src/
│   ├── components/     # Reusable UI & HYDRAX domain components
│   │   ├── hydrax/     # Dashboard widgets, valve controls, charts
│   │   └── ui/         # Radix UI primitives & design tokens
│   ├── routes/         # TanStack file-based routes
│   └── lib/            # Utilities, Firebase IoT sync, state helpers
├── capacitor.config.ts # Capacitor configuration
├── vite.config.ts      # Vite configuration
└── package.json        # Dependencies and scripts
```

---

## 📄 License

This project is licensed under the MIT License.
