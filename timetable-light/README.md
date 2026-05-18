# Cadence Frontend Web Portal

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

</div>

The **Cadence Frontend** is a Next.js 16 SPA (Single Page Application) styled with vanilla Tailwind CSS. It is split into specialized sub-portals targeting specific user roles: admins, faculty members, and student accounts.

---

## 🎨 Layout Overview

```
src/
├── app/
│   ├── (shell)/          # Admin-facing layouts (Dashboard, Master Data, Notices, Builder)
│   ├── login/            # Unified modern portal login interface
│   ├── student-portal/   # Student scores, noticeboards, and grade views
│   ├── teacher-portal/   # Weekly calendar schedules and LLM assessment uploading interface
│   └── globals.css       # Core HSL color variables and styling utility classes
├── components/           # Reusable widgets (Notice Bell, CROPPING models, Skeleton tables)
├── contexts/             # Client state providers (e.g. Academic Year selection context)
└── lib/                  # Fetch API helpers, session logic, and validation constants
```

---

## 🚀 Setup & Local Installation

### Prerequisites

- Node.js (version 20+)
- The backend API (`time-table-backend`) running on port `3001` or config target.

### Installation Steps

1.  Navigate to the frontend directory:
    ```bash
    cd timetable-light
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your environment variables in `.env` (refer to `env.example`):
    ```ini
    API_BACKEND_URL=http://localhost:3001
    ```
4.  Launch the Next.js development server:
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Routing & Dynamic Rewrites

The frontend implements dynamic rewrites in [next.config.ts] to direct all API and static file requests cleanly to the backend:

```ts
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: `${API_BACKEND_URL}/api/:path*`,
    },
    {
      source: "/uploads/:path*",
      destination: `${API_BACKEND_URL}/uploads/:path*`,
    },
  ];
}
```

This prevents complex client-side CORS issues and routes all relative client requests smoothly through Next.js.

---

## 🔧 Production Compilation

To bundle and test Next.js for production execution:

```bash
# Build the optimized production bundle
npm run build

# Start the compiled production app locally
npm run start
```
