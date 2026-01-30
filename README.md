# 🏢 HRMS Backend System (Human Resource Management System)

This repository contains the server-side architecture for a comprehensive **Human Resource Management System (HRMS)**. It is built using **Node.js** and **Express.js**, designed to handle complex HR operations including attendance tracking with geolocation, payroll processing, real-time chat, leave management, and role-based access control.

## 🚀 Tech Stack

### Core Frameworks
*   **Node.js**: Runtime environment.
*   **Express.js**: RESTful API framework.

### Database
*   **MongoDB**: NoSQL database for flexible data storage.
*   **Mongoose**: ODM (Object Data Modeling) library for schema validation and relationships.

### Authentication & Security
*   **JWT (JSON Web Tokens)**: Secure stateless authentication.
*   **Bcrypt**: Password hashing.
*   **RBAC (Role-Based Access Control)**: Middleware to differentiate between `Admin`, `Manager`, and `Employee` access (`protect`, `onlyAdmin`).

### File Storage & Media
*   **Multer**: Middleware for handling `multipart/form-data` (file uploads).
*   **Cloudinary**: Cloud storage for employee profile pictures, expense receipts, and notice attachments.

### Real-Time & Communication
*   **Socket.io**: Real-time bidirectional event-based communication (used for chat and live notifications).
*   **Brevo (formerly Sendinblue)**: Email service for sending leave alerts, onboarding emails, and OTPs.

### External Integrations
*   **Google Calendar API**: For scheduling HR interviews/meetings.
*   **Google Maps/Location Services**: For reverse geocoding punch-in/out coordinates.

---

## 🌟 Key Features Implemented

### 1. 🔐 Authentication & Authorization
*   **Secure Login**: JWT-based session management.
*   **Role Management**: Distinct routes for Admins and Employees.
*   **Password Management**: Change password functionality.

### 2. 👥 Employee Management
*   **Onboarding**: Admin can create employees, auto-generating IDs based on Company Prefix (e.g., `VAG01`).
*   **Profile Management**: Employees can upload profile pictures and documents.
*   **Status Control**: Admin can Activate/Deactivate employees (e.g., upon resignation).

### 3. 📍 Smart Attendance System
*   **Geo-Fencing**: Employees must punch in with Latitude/Longitude. The system validates if they are within the allowed office radius.
*   **Shift Logic**:
    *   Auto-calculation of "Late" vs "On Time" based on assigned shift.
    *   Grace period handling.
    *   Status tracking: `Working`, `Completed`, `Absent`, `Half Day`.
*   **Correction Requests**: Employees can request attendance correction; Admins can approve/reject.
*   **Admin Override**: Admin can force punch-out an employee.

### 4. 💸 Payroll Automation
*   **Salary Calculation**: Automated calculation based on:
    *   Basic, HRA, Conveyance, Medical allowances.
    *   **PF (Provident Fund) & PT (Professional Tax)** logic configurable via settings.
    *   Deductions for LOP (Loss of Pay) and Lateness.
*   **Batch Processing**: Generate payroll for all employees for a specific month.

### 5. 📅 Leave & Work Mode Management
*   **Leave Requests**: Apply for Paid/Unpaid/Sick leave with date ranges.
*   **Work Modes**:
    *   Request specific modes: **WFO** (Work From Office), **WFH** (Work From Home), or **Hybrid**.
    *   Admin approval workflow for temporary or permanent mode changes.
*   **Email Notifications**: Admins receive emails when leaves are applied.

### 6. 💬 Real-Time Chat & Collaboration
*   **1-on-1 Chat**: Private messaging between employees.
*   **Group Chat**: Team-based communication.
*   **Features**:
    *   Unread message counts.
    *   Message history persistence.
    *   Real-time delivery using Socket.io.

### 7. 📢 Notices & Company Rules
*   **Digital Notice Board**: Admins can post notices (text + images) to specific departments or the whole company.
*   **Interaction**: Employees can reply to notices (like a forum thread).
*   **Company Rules**: visual rulebooks uploaded via Cloudinary.

### 8. 💰 Expense Management
*   **Reimbursements**: Employees upload receipts (images/PDFs) for expenses.
*   **Workflow**: Admin reviews and changes status to Approved/Rejected.

### 9. ⚠️ Idle Time & Overtime
*   **Idle Monitoring**: System tracks idle time (likely via frontend integration) and logs it.
*   **Overtime**: Employees apply for OT; Admins review and approve.

---

## 📂 Project Structure Overview

```bash
/controllers    # Business logic for each feature (Auth, Attendance, Payroll, etc.)
/models         # Mongoose Schemas (User, Attendance, Leave, Expense, etc.)
/routes         # API Route definitions mapping to controllers
/middleware     # Auth protection, Role checks, File upload configs
/services       # Helper services (Email, Location, Cloudinary)
/config         # Database and Cloudinary configuration
```

### Key Modules Explained

1.  **`attendanceRoutes.js` & `EmployeeattendanceRoutes.js`**:
    *   Separates logic for Admin (viewing all) vs. Employee (punching in).
    *   Uses MongoDB Aggregation pipelines for complex date-range reporting.

2.  **`payroll.js`**:
    *   Contains the core formulas for Indian salary structures (PF, PT Slabs).
    *   Updates `PayrollRecord` with detailed breakdowns.

3.  **`adminRoutes.js`**:
    *   Handles "Office Settings" (Global GPS coordinates, Work modes).
    *   Central hub for configuration.

4.  **`chat.js`**:
    *   Manages `Message` models.
    *   Aggregates conversations to show the "Last Message" in the inbox view.

---

## ⚙️ Setup & Installation

### Prerequisites
*   Node.js (v14+)
*   MongoDB (Local or Atlas)
*   Cloudinary Account
*   Brevo (Sendinblue) Account
*   Google Cloud Console Project (for Maps/Calendar)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/hrms-backend.git
cd hrms-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and add the following:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Cloudinary Config
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Service (Brevo)
BREVO_API_KEY=your_brevo_key
EMAIL_FROM=no-reply@yourcompany.com

# Google APIs
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/meeting/auth/callback
```

### 4. Run the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

---

## 📡 API Endpoints Overview

| Feature | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | POST | `/api/auth/login` | Login user |
| **Attendance** | POST | `/api/attendance/punch-in` | Punch in with Location |
| **Attendance** | GET | `/api/attendance/by-range` | Admin report (Aggregation) |
| **Employee** | POST | `/api/employee` | Create new employee (Admin) |
| **Payroll** | POST | `/api/payroll/save-batch` | Process monthly payroll |
| **Leave** | POST | `/api/leave/apply` | Apply for leave |
| **Chat** | POST | `/api/chat/send` | Send a message |
| **Company** | GET | `/api/company` | Get company details |

---


**Developed by:** [Your Name]
*An advanced HRMS solution streamlining workforce management.*
