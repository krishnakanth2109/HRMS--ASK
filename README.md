# HRMS Frontend - Human Resource Management System

A comprehensive, feature-rich Human Resource Management System (HRMS) frontend built with modern web technologies. This system provides a complete solution for managing employees, attendance, leaves, payroll, expenses, and company communications.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Key Components](#-key-components)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Integration](#-api-integration)
- [Feature Deep Dive](#-feature-deep-dive)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 👥 Employee Management
- **Add New Employees**: Comprehensive employee onboarding with multi-company support
- **Edit Employee Details**: Update personal, professional, and banking information
- **Multi-Company Support**: Manage employees across different companies with unique ID prefixes
- **Auto-Generated Employee IDs**: Backend-synced employee ID generation per company
- **Profile Management**: Complete employee profiles with photos and documents
- **Employment Type Tracking**: Full-Time, Contract, and Intern classifications

### ⏰ Attendance Management
- **Real-Time Attendance Tracking**: Live monitoring of employee check-ins/check-outs
- **Geolocation Tracking**: GPS coordinates for punch-in/out locations
- **Late Login Management**: Admin approval system for late arrival corrections
- **Shift Management**: Customizable shifts with grace periods and weekly offs
- **Attendance Reports**: Comprehensive attendance analytics and exports
- **Multiple Views**: Today's overview, historical data, and employee-specific views

### 🏖️ Leave Management
- **Leave Request System**: Employee leave applications with reason and attachments
- **Admin Approval Workflow**: Approve/reject leave requests with comments
- **Leave Balance Tracking**: Real-time leave balance calculations
- **Leave History**: Complete leave history with status tracking
- **Leave Summary Reports**: Monthly and yearly leave analytics
- **Multiple Leave Types**: Sick, casual, earned, and custom leave categories

### 💰 Payroll Management
- **Automated Salary Calculations**: Based on attendance, leaves, and overtime
- **Configurable Salary Rules**: Custom percentage-based calculations
- **Allowances & Deductions**: HRA, Conveyance, Medical, PF, PT, and more
- **Payslip Generation**: Professional payslip exports in Excel format
- **Month-wise Processing**: Historical payroll data with filtering
- **Tax Calculations**: Professional Tax (PT) and Provident Fund (PF) calculations

### 💸 Expense Management
- **Expense Submission**: Employee expense claims with receipt uploads
- **Admin Approval System**: Review and approve/reject expense requests
- **Receipt Management**: Support for images and PDF receipts
- **Category Management**: Categorized expenses (Travel, Food, Medical, etc.)
- **Expense Reports**: Filtered views by status and category
- **Expense Analytics**: Track total expenses and pending approvals

### 📅 Holiday & Calendar Management
- **Holiday Calendar**: Company-wide holiday management
- **Birthday Tracking**: Automatic employee birthday reminders
- **Visual Calendar**: Interactive calendar with holiday highlights
- **Bulk Import**: Excel import for bulk holiday uploads
- **Holiday Categories**: Different holiday types with color coding
- **Year-wise Filtering**: View holidays by specific years

### 📢 Communication & Notices
- **Notice Board**: Company-wide announcements and notifications
- **Targeted Messaging**: Send notices to specific employees or departments
- **Group Management**: Create and manage employee groups
- **Meeting Scheduler**: Schedule meetings with Google Meet integration
- **Real-time Notifications**: Instant notice delivery to employees
- **Read Receipts**: Track who has read notices
- **Reply System**: Two-way communication with image attachments
- **Quick Replies**: Pre-defined response templates

### 📜 Rules & Regulations
- **Company Policy Management**: Post and manage company rules
- **Multi-Image Support**: Attach multiple images to regulations
- **Category Organization**: Categorize rules (Safety, HR Policy, General)
- **Image Gallery**: Carousel view for regulation images
- **Easy Updates**: Edit or delete existing regulations

### 🔧 Department & Shift Settings
- **Department Management**: Create and manage departments
- **Shift Configuration**: Customizable shift timings and parameters
- **Bulk Operations**: Assign shifts to multiple employees
- **Group-based Assignment**: Assign shifts by employee groups
- **Grace Period Settings**: Configure late arrival grace periods
- **Auto-extend Shifts**: Automatic shift extension based on overtime

### 🔐 Security & Authentication
- **Password Management**: Secure password change functionality
- **Password Strength Indicator**: Real-time password strength validation
- **Session Management**: Secure authentication with JWT tokens
- **Role-based Access**: Admin and employee role segregation
- **Secure API Calls**: Centralized API with authentication headers

---

## 🛠️ Tech Stack

### Frontend Framework & Libraries
- **React 18.x**: Modern React with Hooks and Functional Components
- **React Router DOM**: Client-side routing and navigation
- **React Icons**: Comprehensive icon library (Font Awesome)

### UI & Styling
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Framer Motion**: Advanced animations and transitions
- **React Calendar**: Interactive calendar component
- **SweetAlert2**: Beautiful alert and confirmation dialogs

### State Management & Data Handling
- **React Context API**: Global state management (AuthContext)
- **Custom Hooks**: Reusable hooks for common functionality
- **Axios**: HTTP client for API requests

### File Handling & Export
- **XLSX (SheetJS)**: Excel file generation and parsing
- **FileSaver.js**: Client-side file downloads
- **HTML-to-Image**: Screenshot and image generation from DOM

### Form Handling & Validation
- **Controlled Components**: React-controlled form inputs
- **Custom Validation**: Real-time form validation
- **File Upload**: Support for images and PDF documents

---

## 📁 Project Structure

```
hrms-frontend/
│
├── src/
│   ├── api/
│   │   └── index.js                    # Centralized API functions
│   │
│   ├── context/
│   │   └── AuthContext.js              # Authentication context
│   │
│   ├── pages/
│   │   ├── AddEmployee.jsx             # Employee onboarding
│   │   ├── EditEmployee.jsx            # Employee profile editing
│   │   ├── AdminExpense.jsx            # Expense approval dashboard
│   │   ├── AdminHolidayCalendarPage.jsx # Holiday management
│   │   ├── AdminLeavemanagmentPanel.jsx # Leave approvals
│   │   ├── AdminLeaveSummary.jsx       # Leave analytics
│   │   ├── AdminLateRequests.jsx       # Late login approvals
│   │   ├── AdminNotices.jsx            # Communication center
│   │   ├── AdminRulespost.jsx          # Company regulations
│   │   ├── AdminviewAttendance.jsx     # Attendance monitoring
│   │   ├── DepartmentSettings.jsx      # Shift & department config
│   │   ├── Payroll.jsx                 # Payroll processing
│   │   ├── TodayOverview.jsx           # Daily attendance dashboard
│   │   └── ChangePasswordPage.jsx      # Password management
│   │
│   ├── components/                     # Reusable UI components
│   ├── utils/                          # Utility functions
│   ├── App.jsx                         # Main application component
│   └── index.js                        # Application entry point
│
├── public/                             # Static assets
├── package.json                        # Dependencies
└── README.md                           # Project documentation
```

---

## 🔑 Key Components

### 1. **AddEmployee.jsx**
**Purpose**: Complete employee onboarding system

**Key Features**:
- Multi-company support with company selection dropdown
- Auto-generated employee IDs synced with backend
- Comprehensive form with sections for:
  - Personal details (name, email, phone, address, DOB, gender)
  - Professional details (role, department, salary, joining date, employment type)
  - Banking information (account number, IFSC, bank name)
  - Emergency contact
  - Password setup with strength indicator
- Company management modal for creating new companies
- Company deletion functionality
- Real-time form validation with field-specific error messages
- Duplicate email detection
- Password visibility toggle
- Responsive design with Tailwind CSS

**Implementation Highlights**:
```javascript
// Auto-generate Employee ID based on company
const handleCompanyChange = async (companyId) => {
  const idResponse = await getNextEmployeeId(companyId);
  setFormData(prev => ({
    ...prev,
    employeeId: idResponse.nextEmployeeId
  }));
};
```

---

### 2. **EditEmployee.jsx**
**Purpose**: Employee profile editing and updates

**Key Features**:
- Pre-populated form with existing employee data
- Read-only employee ID field
- Employment type dropdown (Full-Time, Contract, Intern)
- Professional details update
- Banking information update
- Experience details synchronization
- Success/error notifications
- Navigation back to previous page

**Implementation Highlights**:
- Fetches employee data by ID using `getEmployeeById(id)`
- Updates current experience entry for employees with "Present" status
- Nested object updates for bank and personal details

---

### 3. **AdminLateRequests.jsx**
**Purpose**: Manage employee late arrival correction requests

**Key Features**:
- Displays all pending late login correction requests
- Card-based UI showing:
  - Employee name and ID
  - Date of late arrival
  - Original punch-in time vs. requested time
  - Reason for correction
- Search and filter functionality
- Approve/Reject actions with confirmation dialogs
- Optimistic UI updates for instant feedback
- Loading states during API calls
- Refresh functionality

**Implementation Highlights**:
```javascript
// Optimistic update removes request immediately
setRequests(prevRequests => prevRequests.filter(r => 
  !(r.employeeId === reqItem.employeeId && r.date === reqItem.date)
));
```

**User Experience**:
- SweetAlert2 confirmation dialogs
- Loading spinner during approval/rejection
- Real-time list updates without full page refresh

---

### 4. **AdminExpense.jsx**
**Purpose**: Expense approval and management dashboard

**Key Features**:
- Tabbed filtering (All, Pending, Approved, Rejected)
- Expense statistics dashboard
- Receipt viewing (images and PDFs) in modal
- Approve/Reject workflow with confirmations
- Action date tracking
- Category-wise organization
- Amount display with currency formatting

**Implementation Highlights**:
- Modal receipt viewer supporting both images and PDFs
- File type detection for appropriate rendering
- Timestamp tracking for approval/rejection actions

---

### 5. **AdminHolidayCalendarPage.jsx**
**Purpose**: Comprehensive holiday and birthday management

**Key Features**:
- Interactive visual calendar
- Holiday creation, editing, and deletion
- Employee birthday tracking
- Bulk holiday import via Excel
- Year-wise filtering
- Multi-day holiday support
- Holiday categories with color coding
- Month navigation

**Implementation Highlights**:
```javascript
// Excel import functionality
const handleFileImport = async (e) => {
  const file = e.target.files[0];
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  // Parse and import holidays
};
```

---

### 6. **AdminLeavemanagmentPanel.jsx**
**Purpose**: Centralized leave request management

**Key Features**:
- Filter by month, department, and status
- Employee search functionality
- Leave request cards with full details
- Attachment viewing (images and PDFs)
- Approve/Reject with comments
- Leave duration calculation
- Employee profile images
- Status-based color coding
- Mobile-responsive design

**Implementation Highlights**:
- Secure URL handling for HTTPS enforcement
- Real-time leave balance calculations
- Employee data mapping for quick lookups

---

### 7. **AdminLeaveSummary.jsx**
**Purpose**: Comprehensive leave analytics and reporting

**Key Features**:
- Month-wise leave summary
- Employee-wise leave breakdown
- Attendance integration
- Holiday exclusion logic
- Leave type categorization
- Excel export functionality
- Search and sort capabilities
- Detailed leave history modal

**Implementation Highlights**:
```javascript
// Complex date range processing
const calculateEmployeeLeaves = (employee, startDate, endDate) => {
  // Iterate through date range
  // Exclude weekends and holidays
  // Count leave days by type
};
```

---

### 8. **AdminviewAttendance.jsx**
**Purpose**: Comprehensive attendance monitoring and reporting

**Key Features**:
- Date range selection
- Employee filtering and search
- Status-based filtering (Present, Absent, Late, Leave)
- Location viewing with Google Maps integration
- Shift information display
- Overtime tracking
- Attendance export to Excel
- Real-time status indicators
- Working hours calculation

**Implementation Highlights**:
- Geolocation integration for punch locations
- Shift-based late calculation with grace periods
- Screenshot generation for sharing
- Complex status determination logic

---

### 9. **AdminNotices.jsx**
**Purpose**: Advanced communication and notification system

**Key Features**:
- Notice creation with rich text
- Recipient targeting:
  - All employees
  - Specific employees
  - Department groups
  - Working employees only
- Meeting scheduler with Google Meet integration
- Read receipt tracking
- Reply system with image attachments
- Quick reply templates
- Group management (create, edit, delete)
- Notice editing and deletion
- View history tracking

**Implementation Highlights**:
```javascript
// Dynamic recipient selection
const sendNotice = async () => {
  if (sendTo === 'SPECIFIC') {
    // Send to selected employees
  } else if (sendTo === 'GROUP') {
    // Send to group members
  } else if (sendTo === 'WORKING') {
    // Send to currently working employees
  }
};
```

**Advanced Features**:
- Meeting link management with default Google Meet
- Real-time working status detection
- Image upload for replies
- Read state persistence on server

---

### 10. **AdminRulespost.jsx**
**Purpose**: Company regulations and policy management

**Key Features**:
- Create regulations with categories
- Multi-image upload support
- Image carousel with auto-rotation
- Full-screen image modal
- Category-based color coding
- Regulation deletion with confirmation
- Responsive card layout

---

### 11. **DepartmentSettings.jsx**
**Purpose**: Shift and group management

**Key Features**:
- Individual and bulk shift assignment
- Shift configuration:
  - Start/end times
  - Late grace period
  - Full day and half day hour thresholds
  - Auto-extend shift option
  - Weekly off days selection
- Employee group management (synced with server)
- Unassigned employee tracking
- Search and filter capabilities
- Bulk operations for multiple employees

**Implementation Highlights**:
- Server-side group persistence via notice system
- Real-time shift updates
- Validation for shift timings

---

### 12. **Payroll.jsx**
**Purpose**: Automated payroll processing and salary calculation

**Key Features**:
- Month-wise payroll processing
- Attendance-based calculations:
  - Present days
  - Leave days (with different multipliers)
  - Half days
  - Absent days
- Configurable salary components:
  - Basic (percentage of CTC)
  - HRA (percentage of CTC)
  - Conveyance (fixed)
  - Medical (fixed)
  - Special Allowance (auto-calculated)
- Deductions:
  - PF (configurable: percentage or fixed)
  - Professional Tax (slab-based)
- Salary rules configuration panel
- Excel export for payslips
- Detailed salary breakdown

**Implementation Highlights**:
```javascript
// Complex salary calculation
const calculateSalary = (employee, attendance, leaves) => {
  const ctc = employee.currentSalary;
  const basic = ctc * (rules.basicPercentage / 100);
  const hra = ctc * (rules.hraPercentage / 100);
  // ... other calculations
  const grossSalary = basic + hra + conveyance + medical + specialAllowance;
  const deductions = pf + pt;
  const netSalary = grossSalary - deductions;
};
```

---

### 13. **TodayOverview.jsx**
**Purpose**: Real-time daily attendance dashboard

**Key Features**:
- Live attendance counters:
  - Present employees
  - Absent employees
  - On leave employees
  - Late arrivals
- Real-time working timer for each employee
- Employee profile cards with:
  - Photo
  - Name, ID, Department
  - Check-in time and status
  - Live working duration
  - Contact actions (Call, Email, WhatsApp)
- Multiple view modes (Grid/List)
- Search and filter functionality
- Status-based color coding
- Quick contact options

**Implementation Highlights**:
```javascript
// Live timer component
const LiveTimer = ({ startTime }) => {
  const [timeStr, setTimeStr] = useState("00:00:00");
  
  useEffect(() => {
    const interval = setInterval(() => {
      // Calculate elapsed time
      const elapsed = new Date() - new Date(startTime);
      // Format as HH:MM:SS
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
};
```

---

### 14. **ChangePasswordPage.jsx**
**Purpose**: Secure password change functionality

**Key Features**:
- Current password verification
- New password with strength indicator
- Password confirmation matching
- Password visibility toggle
- Real-time validation
- Strength levels: Weak, Medium, Strong
- Success/error notifications
- Auto-clear form on success

**Implementation Highlights**:
- Password strength calculation based on:
  - Length (minimum 6 characters)
  - Uppercase letters
  - Numbers
- Visual strength indicator bar
- Secure password masking with show/hide toggle

---

## 🚀 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Backend API server running

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/hrms-frontend.git
cd hrms-frontend
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name
REACT_APP_CLOUDINARY_UPLOAD_PRESET=your_preset
```

4. **Start the development server**
```bash
npm start
# or
yarn start
```

The application will open at `http://localhost:3000`

---

## 💻 Usage

### Admin Dashboard Access
1. Login with admin credentials
2. Navigate through the sidebar menu
3. Access different modules:
   - Today's Overview
   - Attendance Management
   - Leave Management
   - Employee Management
   - Payroll
   - Expenses
   - Holidays & Notices

### Employee Management
1. Click "Add Employee" from the sidebar
2. Select company or create new company
3. Fill in employee details
4. System auto-generates employee ID
5. Submit to create employee profile

### Attendance Tracking
1. Navigate to "Attendance" section
2. Select date range
3. View attendance records
4. Export to Excel if needed

### Leave Approvals
1. Go to "Leave Management"
2. Review pending requests
3. Click Approve/Reject
4. Add comments if needed

### Payroll Processing
1. Open "Payroll" module
2. Select month
3. System auto-calculates salaries
4. Review and export payslips

---

## 🔌 API Integration

### Centralized API Structure

All API calls are centralized in `src/api/index.js`:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Employee APIs
export const getEmployees = () => api.get('/api/employees');
export const addEmployee = (data) => api.post('/api/employees', data);
export const updateEmployeeById = (id, data) => api.put(`/api/employees/${id}`, data);

// Attendance APIs
export const getAttendanceByDateRange = (start, end) => 
  api.get('/api/attendance', { params: { start, end } });

// Leave APIs
export const getLeaveRequests = () => api.get('/api/leaves');
export const approveLeaveRequestById = (id) => api.put(`/api/leaves/${id}/approve`);

// ... other APIs
```

### API Endpoints Used

**Employee Management**
- `GET /api/employees` - Fetch all employees
- `POST /api/employees` - Create new employee
- `GET /api/employees/:id` - Get employee by ID
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

**Attendance**
- `GET /api/attendance` - Get attendance by date range
- `POST /api/attendance/approve-correction` - Approve late correction

**Leave Management**
- `GET /api/leaves` - Get all leave requests
- `POST /api/leaves` - Create leave request
- `PUT /api/leaves/:id/approve` - Approve leave
- `PUT /api/leaves/:id/reject` - Reject leave

**Payroll**
- `GET /api/payroll/rules` - Get payroll rules
- `POST /api/payroll/rules` - Update payroll rules

**Expenses**
- `GET /api/expenses` - Get all expenses
- `PUT /api/expenses/:id/status` - Update expense status

**Holidays**
- `GET /api/holidays` - Get all holidays
- `POST /api/holidays` - Create holiday
- `PUT /api/holidays/:id` - Update holiday
- `DELETE /api/holidays/:id` - Delete holiday

**Notices**
- `GET /api/notices/admin` - Get all notices for admin
- `POST /api/notices` - Create notice
- `PUT /api/notices/:id` - Update notice
- `DELETE /api/notices/:id` - Delete notice

---

## 🎯 Feature Deep Dive

### Late Login Correction System

**Problem Solved**: Employees arriving late due to traffic or emergencies need a way to request attendance correction.

**Solution**:
1. Employee submits correction request with reason and desired time
2. Request appears in admin panel with visual comparison
3. Admin approves/rejects with confirmation
4. System updates attendance record automatically
5. Optimistic UI updates provide instant feedback

**Technical Implementation**:
- Real-time filtering and search
- Optimistic updates for better UX
- Loading states during API operations
- Background sync to maintain data consistency

---

### Multi-Company Employee Management

**Problem Solved**: Organizations with multiple subsidiaries need separate employee ID sequences.

**Solution**:
1. Create companies with unique prefixes (e.g., "ARA", "TEC")
2. Backend maintains separate counters per company
3. Auto-generate employee IDs: `ARA-0001`, `TEC-0001`
4. Prevent ID conflicts across companies

**Technical Implementation**:
```javascript
// Company structure
{
  name: "ARAH Infotech",
  prefix: "ARA",
  nextEmployeeNumber: 15 // Server-side counter
}

// Generated ID
employeeId = `${prefix}-${String(nextEmployeeNumber).padStart(4, '0')}`
// Result: ARA-0015
```

---

### Payroll Calculation Engine

**Complex Calculation Flow**:

1. **Data Collection**:
   - Employee salary (CTC)
   - Attendance records
   - Leave records
   - Holidays
   - Shift configurations

2. **Day Categorization**:
   - Present days: Full salary
   - Leave days: 100% or configurable percentage
   - Half days: 50% of daily rate
   - Absent days: 0% salary
   - Holidays: Excluded from calculations

3. **Salary Components**:
   ```
   Basic = CTC × 40%
   HRA = CTC × 40%
   Conveyance = ₹1,600
   Medical = ₹1,250
   Special Allowance = CTC - (Basic + HRA + Conveyance + Medical)
   ```

4. **Deductions**:
   ```
   PF = Basic × 12% (configurable)
   PT = ₹150 or ₹200 based on salary slabs
   ```

5. **Net Salary**:
   ```
   Gross = Basic + HRA + Conveyance + Medical + Special Allowance
   Total Deductions = PF + PT
   Net Salary = Gross - Total Deductions
   ```

---

### Notice Communication System

**Advanced Features**:

1. **Recipient Targeting**:
   - **All**: Broadcast to entire organization
   - **Specific**: Select individual employees
   - **Groups**: Pre-defined employee groups
   - **Working**: Only currently working employees

2. **Meeting Integration**:
   - Toggle meeting mode
   - Set date and time
   - Customizable Google Meet link
   - Automatic notice formatting with meeting details

3. **Read Receipts**:
   - Track which employees viewed notice
   - Display view timestamp
   - Visual "seen" indicators

4. **Reply System**:
   - Two-way communication
   - Image attachment support
   - Quick reply templates
   - Reply history tracking

5. **Group Management**:
   - Create custom groups (e.g., "Engineering", "HR")
   - Add/remove members
   - Server-side persistence
   - Reusable for multiple notices

---

## 📊 Data Flow Architecture

```
User Action → Component State → API Call → Backend Processing
                                           ↓
Frontend Updates ← API Response ← Database Operation
         ↓
   Optimistic UI ← Local State Update
```

### Example: Leave Approval Flow

```
1. Admin clicks "Approve" on leave request
   ↓
2. Confirmation dialog (SweetAlert2)
   ↓
3. API call: PUT /api/leaves/:id/approve
   ↓
4. Backend updates database
   ↓
5. Response received
   ↓
6. Local state updated
   ↓
7. UI refreshes to show updated status
   ↓
8. Success notification displayed
```

---

## 🎨 UI/UX Highlights

### Design Principles
- **Responsive First**: Mobile, tablet, and desktop optimized
- **Consistent Color Scheme**: Status-based color coding throughout
- **Intuitive Navigation**: Clear sidebar with icons and labels
- **Instant Feedback**: Loading states, success/error messages
- **Accessibility**: ARIA labels, keyboard navigation support

### Color Coding System
- 🟢 **Green**: Approved, Present, Success states
- 🔴 **Red**: Rejected, Absent, Error states
- 🟡 **Yellow**: Pending, Warning states
- 🔵 **Blue**: Information, Primary actions
- ⚪ **Gray**: Disabled, Inactive states

### Interactive Elements
- Hover effects on all clickable elements
- Smooth transitions and animations (Framer Motion)
- Loading spinners for async operations
- Toast notifications for user feedback
- Modal dialogs for detailed views

---

## 🔒 Security Features

1. **Authentication**:
   - JWT token-based authentication
   - Token stored in localStorage
   - Automatic token inclusion in API requests
   - Token refresh mechanism

2. **Authorization**:
   - Role-based access control (Admin/Employee)
   - Protected routes
   - API-level permission checks

3. **Data Protection**:
   - Password hashing (handled by backend)
   - Secure HTTPS connections
   - Input sanitization
   - XSS protection

4. **Password Security**:
   - Minimum length enforcement
   - Strength indicator
   - Current password verification
   - Password mismatch prevention

---

## 📈 Performance Optimizations

1. **React Optimizations**:
   - `useMemo` for expensive calculations
   - `useCallback` for function memoization
   - Lazy loading for heavy components
   - Code splitting

2. **API Optimizations**:
   - Request debouncing for search
   - Pagination for large datasets
   - Caching frequently accessed data
   - Optimistic updates for better UX

3. **Bundle Optimizations**:
   - Tree shaking
   - Minification
   - Compression
   - Asset optimization

---

## 🧪 Testing

### Testing Strategy
- Unit tests for utility functions
- Component tests for UI logic
- Integration tests for API calls
- E2E tests for critical workflows

### Test Cases Coverage
- Employee CRUD operations
- Attendance tracking accuracy
- Leave approval workflow
- Payroll calculations
- Notice delivery system

---

## 🚧 Future Enhancements

### Planned Features
- [ ] Real-time notifications with WebSockets
- [ ] Advanced reporting with charts and graphs
- [ ] Mobile application (React Native)
- [ ] Biometric attendance integration
- [ ] Document management system
- [ ] Performance review module
- [ ] Training and development tracking
- [ ] Recruitment and onboarding module
- [ ] Asset management
- [ ] Time tracking and project management

### Technical Improvements
- [ ] State management with Redux Toolkit
- [ ] GraphQL API integration
- [ ] Server-side rendering (Next.js)
- [ ] Progressive Web App (PWA) support
- [ ] Offline mode capability
- [ ] Multi-language support (i18n)
- [ ] Dark mode theme
- [ ] Accessibility improvements (WCAG 2.1 AA)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/YourFeature`
3. Commit changes: `git commit -m 'Add YourFeature'`
4. Push to branch: `git push origin feature/YourFeature`
5. Submit a pull request

### Coding Standards
- Follow ESLint configuration
- Use functional components with hooks
- Maintain consistent naming conventions
- Write meaningful comments
- Update documentation for new features

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- React team for the amazing framework
- Tailwind CSS for the utility-first CSS framework
- All open-source library contributors
- The development community for inspiration

---

## 📞 Support

For support, email your.email@example.com or join our Slack channel.

---

## 🔗 Links

- [Live Demo](https://your-demo-url.com)
- [Backend Repository](https://github.com/yourusername/hrms-backend)
- [Documentation](https://docs.your-project.com)
- [Issue Tracker](https://github.com/yourusername/hrms-frontend/issues)

---

**Last Updated**: January 2026

**Version**: 1.0.0

---

## 📖 Additional Documentation

For more detailed documentation on specific features, please refer to:
- [Employee Management Guide](docs/employee-management.md)
- [Attendance System](docs/attendance-system.md)
- [Payroll Processing](docs/payroll-processing.md)
- [API Reference](docs/api-reference.md)
- [Deployment Guide](docs/deployment.md)

---

Made with ❤️ by [Your Team Name]







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
