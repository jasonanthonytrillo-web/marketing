# PROJECT MILLION: Multi-Tenant Enterprise POS System 🚀🍔🔊

A high-performance, real-time, multi-tenant Point of Sale (POS) system designed for restaurants and kiosks. Featuring complete store isolation, real-time order tracking via WebSockets, and a premium customer loyalty program.

## ✨ Core Features

*   **Multi-Tenant Architecture**: Complete signal and data isolation between different stores (e.g., Burger Palace vs. Project Million).
*   **Real-Time Notifications**: Instant "Order Ready" alerts with custom chimes and AI voice announcements.
*   **Customer Loyalty System**: Earn and redeem points; restricted to registered members with automatic staff exclusion.
*   **Responsive Kiosk Interface**: High-end, cinematic UI with glassmorphism and smooth animations.
*   **Staff Dashboards**: Specialized views for Admins (Reports/Inventory), Cashiers (Payments), and Kitchen (Preparation).
*   **Dynamic Branding**: Tenant-specific themes, colors, and background images.

## 🛠️ Technology Stack

*   **Frontend**: React 19, Vite, TailwindCSS, Socket.io-client.
*   **Backend**: Node.js, Express, Socket.io, Prisma ORM.
*   **Database**: PostgreSQL.
*   **Real-Time**: WebSockets for cross-tenant signal isolation.

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js (v18+)
*   PostgreSQL Database

### 2. Installation
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Database Setup
```bash
cd backend
npx prisma db push
node src/seed.js
```

### 4. Running the System
From the root directory:
```bash
.\start.bat
```

## 🔒 Security & Isolation
The system uses tenant-prefixed `localStorage` keys and private WebSocket rooms to ensure that customers and staff from different stores never see each other's data or notifications.

## 📝 License
Proprietary - Project Million Ecosystem.
