import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  getLeaveRequests,
  getEmployees,
  getAttendanceByDateRange,
  getHolidays,
  getAllShifts
} from '../api';

// --- HELPER FUNCTIONS ---

const normalizeDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

// Check if a date falls within the selected start and end date
const isDateInRange = (dateStr, startStr, endStr) => {
  const d = new Date(dateStr);
  const start = new Date(startStr);
  const end = new Date(endStr);
  d.setHours(0,0,0,0);
  start.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  return d >= start && d <= end;
};

// ✅ UPDATED: Get Worked Status using shift-specific thresholds
const getWorkedStatus = (punchIn, punchOut, status, fullDayThreshold = 9, halfDayThreshold = 4.5) => {
  const statusUpper = (status || "").toUpperCase();

  if (statusUpper === "LEAVE") return "Leave";
  if (statusUpper === "HOLIDAY") return "Holiday";
  if (statusUpper === "ABSENT" && !punchIn) return "Absent";

  if (punchIn && !punchOut) return "Working..";

  if (!punchIn) return "Absent";

  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);

  if (workedHours >= fullDayThreshold) return "Full Day";
  if (workedHours >= halfDayThreshold) return "Half Day";
  
  return "Absent";
};

// ✅ UPDATED: Helper to determine LATE status using shift data
const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => {
    if (!punchInTime) return "--";
    if (apiStatus === "LATE") return "LATE";
    if (shiftData && shiftData.shiftStartTime) {
      try {
        const punchDate = new Date(punchInTime);
        const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number);
        const shiftDate = new Date(punchDate);
        shiftDate.setHours(sHour, sMin, 0, 0);
        const grace = shiftData.lateGracePeriod || 15;
        shiftDate.setMinutes(shiftDate.getMinutes() + grace);
        if (punchDate > shiftDate) return "LATE";
      } catch (e) {
        console.error("Date calc error", e);
      }
    }
    return "ON_TIME";
};

// ✅ NEW: Check if date is holiday
const isHoliday = (dateStr, holidays) => {
  if (!Array.isArray(holidays)) return null;
  
  const target = new Date(dateStr);
  target.setHours(0,0,0,0);
  
  return holidays.find(h => {
    const start = new Date(h.startDate);
    const end = new Date(h.endDate || h.startDate);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    return target >= start && target <= end;
  });
};

// ✅ NEW: Helper to normalize date string for comparison
const normalizeDateStr = (dateInput) => {
  const d = new Date(dateInput);
  return d.toISOString().split('T')[0];
};

// --- EXPORT FUNCTION ---
const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = { Sheets: { 'Payroll Data': ws }, SheetNames: ['Payroll Data'] };
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(dataBlob, `${fileName}.xlsx`);
};

// --- PAYSLIP MODAL COMPONENT ---
const PayrollSlipModal = ({ employee, onClose, periodStart, periodEnd }) => {
  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  const LOGO_URL = "https://image2url.com/images/1765887261848-a4c3635c-f959-4562-96af-2ed0af32b3c4.png"; 
  const SIGNATURE_URL = "https://signature.freefire-name.com/img.php?f=6&t=Sanjay"; 

  // Export Single Employee Payslip Data
  const handleExportSingle = () => {
      const exportData = [{
          "Employee ID": employee.employeeId,
          "Name": employee.employeeName,
          "Department": employee.department,
          "Role": employee.role,
          "Pay Period Start": periodStart,
          "Pay Period End": periodEnd,
          "Assigned Days": employee.assignedWorkingDays,
          "Worked Days": employee.totalWorkedDays,
          "Leaves Taken": employee.totalLeavesConsumed,
          "LOP Days": employee.lopDays,
          "Late Days Count": employee.lateDaysCount,
          "Late Penalty Days": employee.latePenaltyDays,
          "Base Salary": employee.baseSalary,
          "Per Day Salary": employee.perDaySalary,
          "Worked Salary": employee.workedDaysSalary,
          "LOP Deduction": employee.lopDeduction,
          "Late Deduction": employee.lateDeduction,
          "Net Payable": employee.netPayableSalary
      }];
      exportToExcel(exportData, `Payslip_${employee.employeeName}_${periodStart}`);
  };

  const downloadPayslip = () => {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString('en-IN');
    
    const payslipHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${employee.employeeName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Arial', sans-serif; padding: 40px; background: #f5f5f5; }
          .payslip-container { max-width: 800px; margin: 0 auto; background: white; border: 2px solid #2563eb; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: relative; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 25px 30px; border-bottom: 4px solid #1e3a8a; display: flex; justify-content: space-between; align-items: center; }
          .header-left img { max-height: 60px; background: white; padding: 5px; border-radius: 4px; }
          .header-right { text-align: right; }
          .company-name { font-size: 24px; font-weight: bold; letter-spacing: 1px; }
          .company-address { font-size: 12px; margin-top: 5px; opacity: 0.9; }
          .payslip-title { font-size: 16px; margin-top: 5px; opacity: 0.9; text-transform: uppercase; letter-spacing: 2px; }
          
          .info-section { padding: 20px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .info-item { display: flex; font-size: 14px; }
          .info-label { font-weight: 600; color: #64748b; width: 140px; }
          .info-value { color: #1e293b; font-weight: 600; }
          
          .section-title { background: #e0e7ff; padding: 10px 30px; font-size: 14px; font-weight: bold; color: #1e40af; border-left: 4px solid #2563eb; margin: 15px 0 0 0; text-transform: uppercase; }
          
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .details-table td { padding: 10px 30px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .label-col { color: #475569; width: 65%; }
          .value-col { text-align: right; font-weight: 600; color: #1e293b; }
          
          .earnings-bg { background: #f0fdf4; }
          .deductions-bg { background: #fef2f2; }
          .net-salary-row { background: #1e40af; color: white; }
          .net-salary-row td { padding: 15px 30px; font-size: 18px; font-weight: bold; border: none; }
          
          .footer { padding: 20px 30px; background: #f8fafc; border-top: 2px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
          .signature-section { display: flex; justify-content: space-between; padding: 40px 30px 20px 30px; }
          .signature-box { text-align: center; width: 200px; position: relative; }
          .signature-img { max-height: 60px; position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); }
          .signature-line { border-top: 1px solid #94a3b8; margin-top: 50px; padding-top: 5px; font-weight: 600; color: #475569; font-size: 13px; }
          
          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact; }
            .payslip-container { box-shadow: none; border: 2px solid #2563eb; margin: 0; max-width: 100%; height: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="payslip-container">
          <div class="header">
            <div class="header-left">
              <img src="${LOGO_URL}" alt="Logo" onerror="this.style.display='none'" />
            </div>
            <div class="header-right">
              <div class="company-name">Vagarious Solutions Pvt.Ltd</div>
              <div class="company-address">Ayyappa Society Main Rd
Sri Sai Nagar, Madhapur,
Hyderabad, Telangana-500081</div>
              <div class="payslip-title">Payslip for ${new Date(periodStart).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}</div>
            </div>
          </div>

          <div class="info-section">
            <div class="info-grid">
              <div class="info-item"><span class="info-label">Name:</span><span class="info-value">${employee.employeeName}</span></div>
              <div class="info-item"><span class="info-label">Employee ID:</span><span class="info-value">${employee.employeeId}</span></div>
              <div class="info-item"><span class="info-label">Department:</span><span class="info-value">${employee.department}</span></div>
              <div class="info-item"><span class="info-label">Designation:</span><span class="info-value">${employee.role}</span></div>
              <div class="info-item"><span class="info-label">Pay Period:</span><span class="info-value">${new Date(periodStart).toLocaleDateString('en-IN')} to ${new Date(periodEnd).toLocaleDateString('en-IN')}</span></div>
              <div class="info-item"><span class="info-label">Assigned Days:</span><span class="info-value">${employee.assignedWorkingDays} Days</span></div>
              <div class="info-item"><span class="info-label">Worked Days:</span><span class="info-value">${employee.totalWorkedDays} Days</span></div>
              <div class="info-item"><span class="info-label">LOP Days:</span><span class="info-value" style="color:#dc2626">${employee.lopDays} Days</span></div>
            </div>
          </div>

          <h3 class="section-title">Earnings</h3>
          <table class="details-table earnings-bg">
            <tr>
              <td class="label-col">Basic Salary (Monthly)</td>
              <td class="value-col">${formatCurrency(employee.baseSalary)}</td>
            </tr>
            <tr>
              <td class="label-col">Per Day Rate (Base ÷ Assigned Days)</td>
              <td class="value-col">${formatCurrency(employee.perDaySalary)}</td>
            </tr>
            <tr>
              <td class="label-col">Actual Worked Days Earnings</td>
              <td class="value-col">${formatCurrency(employee.workedDaysSalary)}</td>
            </tr>
          </table>

          <h3 class="section-title">Deductions</h3>
          <table class="details-table deductions-bg">
             <tr>
              <td class="label-col">Loss of Pay (${employee.lopDays} days)</td>
              <td class="value-col" style="color:#dc2626">-${formatCurrency(employee.lopDeduction)}</td>
            </tr>
            <tr>
              <td class="label-col">Late Login Penalty (${employee.lateDaysCount} Lates = ${employee.latePenaltyDays} Days)</td>
              <td class="value-col" style="color:#dc2626">-${formatCurrency(employee.lateDeduction)}</td>
            </tr>
            <tr>
              <td class="label-col"><strong>Total Deductions</strong></td>
              <td class="value-col" style="color:#dc2626">-${formatCurrency(employee.totalDeductions)}</td>
            </tr>
          </table>

          <table class="details-table">
            <tr class="net-salary-row">
              <td>NET PAYABLE SALARY</td>
              <td style="text-align: right;">${formatCurrency(employee.netPayableSalary)}</td>
            </tr>
          </table>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Employee Signature</div>
            </div>
            <div class="signature-box">
              <img src="${SIGNATURE_URL}" class="signature-img" alt="Sign" onerror="this.style.display='none'" />
              <div class="signature-line">Authorized Signatory</div>
            </div>
          </div>

          <div class="footer">
            <p>Generated on ${currentDate}. This is a computer-generated document.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(payslipHTML);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 sticky top-0 z-10 flex justify-between items-center">
          <div>
             <h2 className="text-2xl font-bold tracking-wide">Payroll Summary</h2>
             <p className="text-blue-100 text-sm">{employee.employeeName} ({employee.employeeId})</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition"><span className="text-2xl">×</span></button>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Top Stats Grid - UPDATED */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                <p className="text-xs text-blue-600 font-bold uppercase">Assigned Days</p>
                <p className="text-xl font-extrabold text-blue-900 mt-2">{employee.assignedWorkingDays}</p>
             </div>
             <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                <p className="text-xs text-green-600 font-bold uppercase">Worked Days</p>
                <p className="text-xl font-extrabold text-green-900 mt-2">{employee.totalWorkedDays}</p>
             </div>
             <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                <p className="text-xs text-purple-600 font-bold uppercase">Net Salary</p>
                <p className="text-xl font-extrabold text-purple-900 mt-2">{formatCurrency(employee.netPayableSalary)}</p>
             </div>
             <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                <p className="text-xs text-red-600 font-bold uppercase">LOP Days</p>
                <p className="text-xl font-extrabold text-red-900 mt-2">{employee.lopDays}</p>
             </div>
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                <p className="text-xs text-orange-600 font-bold uppercase">Late Days</p>
                <p className="text-xl font-extrabold text-orange-900 mt-2">{employee.lateDaysCount}</p>
             </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
             <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                   <tr>
                      <th className="px-6 py-3 text-left">Description</th>
                      <th className="px-6 py-3 text-right">Calculation</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                   <tr>
                      <td className="px-6 py-4 font-medium">Monthly Base Salary</td>
                      <td className="px-6 py-4 text-right text-gray-500">Fixed</td>
                      <td className="px-6 py-4 text-right font-bold">{formatCurrency(employee.baseSalary)}</td>
                   </tr>
                   <tr>
                      <td className="px-6 py-4 font-medium">Per Day Salary</td>
                      <td className="px-6 py-4 text-right text-gray-500">{formatCurrency(employee.baseSalary)} / ${employee.assignedWorkingDays} days</td>
                      <td className="px-6 py-4 text-right font-bold">{formatCurrency(employee.perDaySalary)}</td>
                   </tr>
                   <tr className="bg-green-50/50">
                      <td className="px-6 py-4 font-medium text-green-800">Gross Worked Pay</td>
                      <td className="px-6 py-4 text-right text-gray-500">${employee.totalWorkedDays} days × ${formatCurrency(employee.perDaySalary)}</td>
                      <td className="px-6 py-4 text-right font-bold text-green-700">{formatCurrency(employee.workedDaysSalary)}</td>
                   </tr>
                   <tr className="bg-red-50/50">
                      <td className="px-6 py-4 font-medium text-red-800">LOP Deduction (Leaves)</td>
                      <td className="px-6 py-4 text-right text-gray-500">${employee.lopDays} days × ${formatCurrency(employee.perDaySalary)}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-700">-${formatCurrency(employee.lopDeduction)}</td>
                   </tr>
                   <tr className="bg-orange-50/50">
                      <td className="px-6 py-4 font-medium text-orange-800">Late Login Penalty</td>
                      <td className="px-6 py-4 text-right text-gray-500">${employee.lateDaysCount} lates (${employee.latePenaltyDays} days)</td>
                      <td className="px-6 py-4 text-right font-bold text-orange-700">-${formatCurrency(employee.lateDeduction)}</td>
                   </tr>
                   <tr className="bg-gray-800 text-white text-lg">
                      <td className="px-6 py-5 font-bold">NET PAYABLE</td>
                      <td className="px-6 py-5"></td>
                      <td className="px-6 py-5 text-right font-bold">{formatCurrency(employee.netPayableSalary)}</td>
                   </tr>
                </tbody>
             </table>
          </div>

          <div className="flex gap-4 pt-4">
             <button onClick={downloadPayslip} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                🖨️ Print Payslip
             </button>
             <button onClick={handleExportSingle} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">
                📊 Export Excel
             </button>
             <button onClick={onClose} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PayrollManagement = () => {
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); 

  const [summaryStartDate, setSummaryStartDate] = useState(firstDay.toISOString().split("T")[0]);
  const [summaryEndDate, setSummaryEndDate] = useState(lastDay.toISOString().split("T")[0]);

  const [allEmployees, setAllEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [shifts, setShifts] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [
          leavesRes, 
          empRes, 
          attRes, 
          holidayRes, 
          shiftRes
        ] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
          getAttendanceByDateRange(summaryStartDate, summaryEndDate),
          getHolidays(),
          getAllShifts()
        ]);

        const activeEmps = (Array.isArray(empRes) ? empRes : empRes.data).filter(e => e.isActive !== false);
        
        setLeaveRequests(leavesRes || []);
        setAllEmployees(activeEmps);
        setAttendanceData(attRes || []);
        
        const formattedHolidays = (holidayRes || []).map((h) => ({
            ...h,
            start: normalizeDate(h.startDate),
            end: normalizeDate(h.endDate || h.startDate),
        }));
        setHolidays(formattedHolidays);

        setShifts(Array.isArray(shiftRes) ? shiftRes : shiftRes.data || []);

      } catch (error) {
        console.error("Error loading payroll data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [summaryStartDate, summaryEndDate]);

  // --- CORE LOGIC: PROCESSED PAYROLL ---
  const processedPayroll = useMemo(() => {
    if (!allEmployees.length) return [];

    // ✅ Create shift map with proper thresholds
    const shiftMap = {};
    shifts.forEach(s => { 
      shiftMap[s.employeeId] = {
        weeklyOffDays: s.weeklyOffDays || [0],
        fullDayHours: s.fullDayHours || 9,
        halfDayHours: s.halfDayHours || 4.5,
        shiftStartTime: s.shiftStartTime,
        lateGracePeriod: s.lateGracePeriod || 15
      }; 
    });

    // ✅ 1. Process Attendance (Worked Days & Late Counts) - USING CORRECT LOGIC
    const attSummary = {};
    
    attendanceData.forEach(rec => {
        if (!attSummary[rec.employeeId]) {
            attSummary[rec.employeeId] = { full: 0, half: 0, workedDays: 0, lateCount: 0 };
        }
        
        // ✅ Get shift-specific thresholds
        const shift = shiftMap[rec.employeeId];
        const fullDayThreshold = shift?.fullDayHours || 9;
        const halfDayThreshold = shift?.halfDayHours || 4.5;
        
        // ✅ Use proper worked status calculation with shift thresholds
        const status = getWorkedStatus(rec.punchIn, rec.punchOut, rec.status, fullDayThreshold, halfDayThreshold);
        
        if (status === "Full Day") {
            attSummary[rec.employeeId].full++;
            attSummary[rec.employeeId].workedDays += 1;
        } else if (status === "Half Day") {
            attSummary[rec.employeeId].half++;
            attSummary[rec.employeeId].workedDays += 0.5;
        } else if (status === "Leave") {
            // Leaves are handled separately
            attSummary[rec.employeeId].workedDays += 1; // Paid leave counts as worked day
        } else if (status === "Holiday") {
            // Holidays are not counted as working days
        }

        // ✅ Late Login Logic using shift data
        const loginStatus = calculateLoginStatus(rec.punchIn, shift, rec.status);
        if (loginStatus === "LATE") {
            attSummary[rec.employeeId].lateCount++;
        }
    });

    // ✅ 2. Process Leaves
    const leaveSummary = {};

    allEmployees.forEach(emp => {
        const empId = emp.employeeId;
        
        const approvedLeaves = leaveRequests.filter(
            (leave) =>
            leave.employeeId === empId &&
            leave.status === "Approved" &&
            (isDateInRange(leave.from, summaryStartDate, summaryEndDate) || 
             isDateInRange(leave.to, summaryStartDate, summaryEndDate))
        );

        // A. Normal Leave Days
        const normalLeaveDays = approvedLeaves.reduce(
            (total, leave) => total + calculateLeaveDays(leave.from, leave.to),
            0
        );

        // B. Sandwich Logic
        const bookedMap = new Map();
        approvedLeaves.forEach((leave) => {
            const isFullDay = !leave.halfDaySession;
            let curr = new Date(leave.from);
            const end = new Date(leave.to);
            while (curr <= end) {
                bookedMap.set(formatDate(curr), isFullDay);
                curr = addDays(curr, 1);
            }
        });

        let sandwichCount = 0;
        let sandwichDays = 0;

        // Holiday Sandwich
        holidays.forEach((holiday) => {
            if(!isDateInRange(holiday.start, summaryStartDate, summaryEndDate)) return;

            const hStart = new Date(holiday.start);
            const hEnd = new Date(holiday.end);
            const dayBefore = formatDate(addDays(hStart, -1));
            const dayAfter = formatDate(addDays(hEnd, 1));

            const beforeIsFull = bookedMap.get(dayBefore) === true;
            const afterIsFull = bookedMap.get(dayAfter) === true;

            if (beforeIsFull && afterIsFull) {
                const duration = calculateLeaveDays(hStart, hEnd);
                sandwichCount++;
                sandwichDays += duration;
            }
        });

        // Weekend Sandwich
        for (const [dateStr, isFullDay] of bookedMap.entries()) {
            if (!isFullDay) continue;
            if(!isDateInRange(dateStr, summaryStartDate, summaryEndDate)) continue;

            const d = new Date(dateStr);
            if (d.getDay() === 6) { 
                const mondayStr = formatDate(addDays(d, 2));
                if (bookedMap.get(mondayStr) === true) {
                    sandwichCount++;
                    sandwichDays += 1; 
                }
            }
        }

        const totalConsumed = normalLeaveDays + sandwichDays;
        const monthlyCredit = 1; 
        
        const extraLeaves = Math.max(0, totalConsumed - monthlyCredit);
        const paidLeaveCredit = Math.min(totalConsumed, monthlyCredit);

        leaveSummary[empId] = { 
            totalConsumed, 
            extraLeaves, 
            paidLeaveCredit 
        };
    });

    return allEmployees.map(emp => {
        const currentExp = Array.isArray(emp.experienceDetails)
            ? emp.experienceDetails.find((exp) => exp.lastWorkingDate === "Present")
            : null;

        const baseSalary = currentExp?.salary ? Number(currentExp.salary) : 0;
        const shift = shiftMap[emp.employeeId] || { 
          weeklyOffDays: [0], 
          fullDayHours: 9, 
          halfDayHours: 4.5 
        };

        // ✅ 3. Calculate Assigned Working Days (exclude holidays & weekly offs)
        let assignedWorkingDays = 0;
        let curr = new Date(summaryStartDate);
        const end = new Date(summaryEndDate);
        curr.setHours(0,0,0,0);
        end.setHours(0,0,0,0);

        while (curr <= end) {
            const isHol = holidays.some(h => {
                const hS = new Date(h.start); hS.setHours(0,0,0,0);
                const hE = new Date(h.end); hE.setHours(0,0,0,0);
                return curr >= hS && curr <= hE;
            });
            const day = curr.getDay();
            const isOff = shift.weeklyOffDays.includes(day);

            if (!isHol && !isOff) {
                assignedWorkingDays++;
            }
            curr.setDate(curr.getDate() + 1);
        }

        const safeAssignedDays = assignedWorkingDays > 0 ? assignedWorkingDays : 1;
        const perDaySalary = baseSalary / safeAssignedDays;

        // ✅ 4. Get Attendance and Leave Data
        const att = attSummary[emp.employeeId] || { full: 0, half: 0, workedDays: 0, lateCount: 0 };
        const leaves = leaveSummary[emp.employeeId] || { totalConsumed: 0, extraLeaves: 0, paidLeaveCredit: 0 };

        // ✅ 5. Calculate Pay
        
        // A. Worked Earnings (include paid leaves)
        const payableDays = att.workedDays + leaves.paidLeaveCredit;
        const workedDaysSalary = payableDays * perDaySalary;

        // B. LOP Deduction (for extra leaves beyond monthly credit)
        const lopDeduction = leaves.extraLeaves * perDaySalary;

        // C. Late Login Penalty
        // Rule: 3 Late Logins = 0.5 Day Salary Deduction
        const latePenaltyDays = Math.floor(att.lateCount / 3) * 0.5;
        const lateDeduction = latePenaltyDays * perDaySalary;

        const totalDeductions = lopDeduction + lateDeduction;
        
        // Net Calculation - ensure non-negative
        const netPayableSalary = Math.max(0, workedDaysSalary - totalDeductions);

        return {
            employeeId: emp.employeeId,
            employeeName: emp.name,
            department: currentExp?.department || "N/A",
            role: currentExp?.role || "N/A",
            baseSalary,
            perDaySalary,
            assignedWorkingDays,
            totalWorkedDays: att.workedDays,
            
            totalLeavesConsumed: leaves.totalConsumed,
            lopDays: leaves.extraLeaves,
            paidLeaveCredit: leaves.paidLeaveCredit,
            payableDays,

            lateDaysCount: att.lateCount,
            latePenaltyDays,
            lateDeduction,

            workedDaysSalary, 
            lopDeduction,
            totalDeductions,
            netPayableSalary
        };
    });

  }, [allEmployees, shifts, attendanceData, leaveRequests, holidays, summaryStartDate, summaryEndDate]);

  const totals = useMemo(() => {
    return processedPayroll.reduce((acc, curr) => ({
        baseSalary: acc.baseSalary + curr.baseSalary,
        workedSalary: acc.workedSalary + curr.workedDaysSalary, 
        totalDeductions: acc.totalDeductions + curr.totalDeductions,     
        net: acc.net + curr.netPayableSalary
    }), { baseSalary: 0, workedSalary: 0, totalDeductions: 0, net: 0 });
  }, [processedPayroll]);

  const formatCurrency = (val) => `₹${val.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

  const handleExportAll = () => {
      const dataToExport = processedPayroll.map(emp => ({
          "Employee ID": emp.employeeId,
          "Name": emp.employeeName,
          "Base Salary": emp.baseSalary,
          "Assigned Days": emp.assignedWorkingDays,
          "Worked Days": emp.totalWorkedDays,
          "Total Leaves": emp.totalLeavesConsumed,
          "LOP Days": emp.lopDays,
          "Late Count": emp.lateDaysCount,
          "Late Penalty (Days)": emp.latePenaltyDays,
          "Gross Worked Salary": emp.workedDaysSalary,
          "Total Deductions": emp.totalDeductions,
          "Net Payable": emp.netPayableSalary
      }));
      exportToExcel(dataToExport, `Payroll_Report_${summaryStartDate}_to_${summaryEndDate}`);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-50"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-[1800px] mx-auto">
        
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
           <div>
              <h1 className="text-3xl font-extrabold text-gray-900">💰 Payroll Management</h1>
              <p className="text-gray-500 mt-1">Real-time calculation with Late Penalties & LOP</p>
           </div>
           
           <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap gap-4 items-end">
              <div>
                 <label className="text-xs font-bold text-gray-500 uppercase block mb-1">From Date</label>
                 <input type="date" value={summaryStartDate} onChange={e => setSummaryStartDate(e.target.value)} className="border rounded-lg p-2 text-sm font-semibold text-gray-700"/>
              </div>
              <div>
                 <label className="text-xs font-bold text-gray-500 uppercase block mb-1">To Date</label>
                 <input type="date" value={summaryEndDate} onChange={e => setSummaryEndDate(e.target.value)} className="border rounded-lg p-2 text-sm font-semibold text-gray-700"/>
              </div>
              <button 
                onClick={handleExportAll}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow transition h-[42px]"
              >
                📊 Export Report
              </button>
           </div>
        </div>

        {/* SUMMARY CARDS - UPDATED */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-blue-500">
              <p className="text-gray-500 text-sm font-bold uppercase">Total Base Salary</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(totals.baseSalary)}</h3>
           </div>
           
           <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-green-500">
              <p className="text-gray-500 text-sm font-bold uppercase">Worked Salary</p>
              <h3 className="text-2xl font-bold text-green-700">{formatCurrency(totals.workedSalary)}</h3>
              <p className="text-xs text-green-500 mt-1">Based on Attendance + Paid Leave</p>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-l-red-500">
              <p className="text-gray-500 text-sm font-bold uppercase">Total Deductions (LOP)</p>
              <h3 className="text-2xl font-bold text-red-600">-{formatCurrency(totals.totalDeductions)}</h3>
              <p className="text-xs text-red-400 mt-1">Includes Late Login Penalties</p>
           </div>

           <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 rounded-xl shadow-lg text-white">
              <p className="text-indigo-100 text-sm font-bold uppercase">Net Payable</p>
              <h3 className="text-3xl font-extrabold">{formatCurrency(totals.net)}</h3>
           </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
           <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                 <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-bold">
                    <tr>
                       <th className="px-6 py-4">Employee</th>
                       <th className="px-6 py-4 text-center">Assigned Days</th>
                       <th className="px-6 py-4 text-right">Base Salary</th>
                       <th className="px-6 py-4 text-center">Worked Days</th>
                       <th className="px-6 py-4 text-center text-orange-600">Total Leaves</th>
                       <th className="px-6 py-4 text-center text-red-600">LOP Days</th>
                       <th className="px-6 py-4 text-right text-indigo-700 bg-indigo-50">Net Pay</th>
                       <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {processedPayroll.length === 0 ? (
                        <tr><td colSpan="8" className="text-center py-8 text-gray-500">No data found.</td></tr>
                    ) : processedPayroll.map((emp) => (
                       <tr key={emp.employeeId} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                             <div className="font-bold text-gray-800">{emp.employeeName}</div>
                             <div className="text-xs text-gray-500">{emp.employeeId}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                             <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{emp.assignedWorkingDays}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{formatCurrency(emp.baseSalary)}</td>
                          <td className="px-6 py-4 text-center font-bold">{emp.totalWorkedDays}</td>
                          <td className="px-6 py-4 text-center font-bold text-orange-600">{emp.totalLeavesConsumed}</td>
                          <td className="px-6 py-4 text-center font-bold text-red-600">{emp.lopDays}</td>
                          <td className="px-6 py-4 text-right font-bold text-indigo-700 bg-indigo-50 text-base">{formatCurrency(emp.netPayableSalary)}</td>
                          <td className="px-6 py-4 text-center">
                             <button 
                                onClick={() => setSelectedEmployee(emp)}
                                className="text-blue-600 hover:text-blue-800 font-semibold text-xs border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                             >
                                View Slip
                             </button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

      </div>

      {selectedEmployee && (
         <PayrollSlipModal 
            employee={selectedEmployee} 
            onClose={() => setSelectedEmployee(null)} 
            periodStart={summaryStartDate}
            periodEnd={summaryEndDate}
         />
      )}
    </div>
  );
};

export default PayrollManagement;