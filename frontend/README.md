# Yawgriva Frontend App

This is the client-side dashboard application for Yawgriva, built using **Next.js (App Router)**, **Tailwind CSS**, and **TypeScript**. It offers role-based dashboards tailored for farmers, distributors, and administrators.

## Folder Structure

```text
├── app/                  # Next.js App Router folders
│   ├── (dashboard)/      # Role-based secure workspaces (admin, distributor, farmer)
│   ├── login/            # Sign in page
│   ├── register/         # Sign up page
│   ├── trace/            # Public QR-code tracking lookup page
│   ├── globals.css       # Core styling & custom CSS variables design system
│   └── layout.tsx        # Global HTML root layout
├── components/           # Reusable UI components (charts, selects, landing pages)
├── lib/                  # Utilities (API fetching wrappers, Auth helpers, local storage)
└── public/               # Static assets (logos, illustrations)
```

---

## Role-Based Dashboards

1. **Farmer Workspace (`/farmer`):**
   - Harvest Batch Registration.
   - Smart Partner Matching (shows matching distributors based on location).
   - Price Prediction Chart & Community Price reporting.
   - Weekly PDF reports summarizing prices and crops.
   - Real-time AI chat advisor.
2. **Distributor Workspace (`/distributor`):**
   - Incoming shipping requests dashboard.
   - Checkpoint logger with real-time GPS coordinate detection and storage temperature.
   - Checkpoint Photo Upload & Visual AI analysis feedback loop.
   - Interactive Leaflet tracking maps.
3. **Admin Workspace (`/admin`):**
   - User Verification (approving farmer/distributor account credentials).
   - System Anomaly Alerts logs.
   - Real-time LLM agent logs monitor.
   - Community price outliers validation.

---

## Local Installation (Without Docker)

Ensure you have **Node.js v20+** installed:

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Local Environment
Create a `.env.local` file inside the `frontend` folder:
```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## Key Dependencies Used
- **leaflet** & **react-leaflet** — High-performance interactive maps.
- **lucide-react** — Modern, clean UI vector icon library.
- **chart.js** & **react-chartjs-2** — Dynamic charts for price predictions.
