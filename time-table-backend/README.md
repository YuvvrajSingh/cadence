# Cadence API Backend

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)

</div>

The **Cadence API Backend** is a modular TypeScript/Express application responsible for core database operations, conflict-aware scheduling verification, user authentication, and proxying AI grading workloads.

---

## 🚀 Setup & Local Installation

### Prerequisites
- Node.js (version 20+)
- A running MongoDB Atlas instance or local MongoDB server

### Installation Steps
1.  Navigate to the backend directory:
    ```bash
    cd time-table-backend
    ```
2.  Install dependency modules:
    ```bash
    npm install
    ```
3.  Configure your environment variables inside `.env` (use `.env.example` as a template):
    ```ini
    DATABASE_URL="mongodb+srv://..."
    PORT=3001
    JWT_SECRET="your-jwt-secret-string"
    GRADEAI_API_URL="http://127.0.0.1:8000"
    GRADEAI_SHARED_SECRET="super-secret-backend-key"
    ```
4.  Generate the Prisma DB Client:
    ```bash
    npx prisma generate
    ```
5.  Push schemas to your MongoDB database:
    ```bash
    npx prisma db push
    ```
6.  Seed default systems and administrator credentials:
    ```bash
    npm run db:seed
    ```
7.  Start the active development server:
    ```bash
    npm run dev
    ```

---

## 🔧 Available CLI Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Spins up the development TypeScript runner using `tsx`. |
| `npm run build` | Compiles TypeScript files into the runtime directory `dist/`. |
| `npm run start` | Boots the compiled JavaScript production server via `node dist/index.js`. |
| `npm run db:migrate` | Syncs Prisma structures with MongoDB database collections. |
| `npm run db:seed` | Seeds fundamental academic records and default admin logins. |
| `npm run data:populate` | Inserts extended academic terms and class divisions for stress testing. |

---

## 🧩 Key API Integration Layers

*   **Conflict Validation**: Algorithms designed inside routes/timetable check room availability, class timings, and teacher overlaps before saving scheduled events.
*   **GradeAI Gateway Proxy**: Implements streaming proxy pipelines (`/api/gradeai/*`) that handle heavy multi-part student answerbook image uploads, inject credentials, and route grading requests to the AI server.
