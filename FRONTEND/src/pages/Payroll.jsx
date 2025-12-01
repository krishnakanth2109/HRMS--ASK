import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as FileSaver from 'file-saver';
import * as XLSX from 'xlsx';
import {
  getLeaveRequests,
  getEmployees,
  getAttendanceByDateRange,
  getHolidays,
  getAllShifts
} from '../api';

// --- HELPER FUNCTIONS ---

const normalize = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
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
  fromDate.setUTCHours(0, 0, 0, 0);
  toDate.setUTCHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const getShiftDurationInHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 9;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (diffMinutes < 0) diffMinutes += 24 * 60;
  return Math.round((diffMinutes / 60) * 10) / 10;
};

const getWorkedStatus = (punchIn, punchOut, targetWorkHours = 9) => {
  if (!punchIn || !punchOut) return "Absent";
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  if (workedHours >= targetWorkHours) return "Full Day";
  if (workedHours >= (targetWorkHours / 2)) return "Half Day";
  return "Absent";
};

// --- PAYROLL SLIP MODAL COMPONENT ---
const PayrollSlipModal = ({ employee, onClose, monthlyWorkingDays, periodStart, periodEnd, onUpdatePayroll, pfPercentage }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Local state for editing values
  const [editValues, setEditValues] = useState({
    baseSalary: employee.baseSalary,
    incentives: employee.incentives || 0,
    manualDeductions: employee.manualDeductions || 0
  });

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  const handleSave = () => {
    onUpdatePayroll(employee.employeeId, {
      baseSalary: Number(editValues.baseSalary),
      incentives: Number(editValues.incentives),
      manualDeductions: Number(editValues.manualDeductions)
    });
    setIsEditing(false);
  };

  // Dynamic Calculations for Modal Display
  const currentBase = isEditing ? Number(editValues.baseSalary) : employee.baseSalary;
  const currentIncentives = isEditing ? Number(editValues.incentives) : (employee.incentives || 0);
  const currentManualDed = isEditing ? Number(editValues.manualDeductions) : (employee.manualDeductions || 0);

  const perDaySalary = currentBase / monthlyWorkingDays;
  const workedSalary = employee.totalWorkedDays * perDaySalary;
  const lopDeduction = employee.extraLeaves * perDaySalary;
  const pfDeduction = Math.round(currentBase * (pfPercentage / 100));
  
  const netPayableSalary = workedSalary - lopDeduction - pfDeduction - currentManualDed + currentIncentives;

  // --- INDIVIDUAL EXCEL EXPORT ---
  const exportIndividualExcel = () => {
    const data = [{
      "Employee Name": employee.employeeName,
      "Employee ID": employee.employeeId,
      "Role": employee.role,
      "Pay Period": `${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`,
      "Base Salary": currentBase,
      "PF Percentage": `${pfPercentage}%`,
      "PF Amount": pfDeduction,
      "Total Working Days": monthlyWorkingDays,
      "Days Worked": employee.totalWorkedDays,
      "Full Days": employee.fullDays,
      "Half Days": employee.halfDays,
      "Leaves Taken": employee.totalLeaveDays,
      "Sandwich Days": employee.sandwichLeavesDays,
      "Extra Leaves (LOP)": employee.extraLeaves,
      "LOP Deduction": lopDeduction,
      "Incentives": currentIncentives,
      "Other Deductions": currentManualDed,
      "Net Payable Salary": netPayableSalary
    }];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = { Sheets: { data: ws }, SheetNames: ["Payslip_Data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    FileSaver.saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `${employee.employeeName}_Payslip.xlsx`);
  };

  // --- PROFESSIONAL PAYSLIP PRINT ---
  const downloadPayslip = () => {
    const printWindow = window.open('', '_blank');
    
    // REPLACE THIS URL WITH YOUR COMPANY LOGO URL
    const logoUrl = "https://tse3.mm.bing.net/th/id/OIP.pTkF5oa-Ya_Vs2woe98QvwHaCe?pid=Api&P=0&h=180"; 
    
    const payslipHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${employee.employeeName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
          body { font-family: 'Roboto', sans-serif; background: #eef2f5; padding: 20px; -webkit-print-color-adjust: exact; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
          
          /* Header */
          .header { background: #1e3a8a; color: white; padding: 30px; display: flex; justify-content: space-between; align-items: center; }
          .company-info h1 { font-size: 24px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .company-info p { font-size: 12px; opacity: 0.8; margin: 5px 0 0; }
          .payslip-tag { text-align: right; }
          .payslip-tag h2 { font-size: 28px; margin: 0; font-weight: 300; }
          .payslip-tag p { font-size: 14px; opacity: 0.9; margin: 5px 0 0; }
          
          /* Employee Details */
          .emp-details { padding: 20px 30px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .detail-row { display: flex; margin-bottom: 8px; font-size: 14px; }
          .label { width: 120px; font-weight: 600; color: #64748b; }
          .val { color: #1e293b; font-weight: 500; }

          /* Content Table */
          .content { padding: 30px; display: flex; gap: 40px; }
          .col { flex: 1; }
          .col-header { font-size: 14px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 15px; }
          
          .item-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .item-row span:last-child { font-weight: 600; }
          
          .earning-val { color: #059669; }
          .deduction-val { color: #dc2626; }

          /* Net Pay */
          .net-pay-section { background: #1e3a8a; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; }
          .net-pay-label { font-size: 16px; font-weight: 500; }
          .net-pay-amount { font-size: 24px; font-weight: 700; }
          
          .amount-words { background: #f1f5f9; padding: 10px 30px; font-size: 12px; color: #64748b; font-style: italic; }

          .footer { padding: 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 0; }
          
          @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="company-info">
              <!-- COMPANY LOGO HERE -->
              <img src="${logoUrl}" alt="Company Logo" style="height: 40px; margin-bottom: 10px; display: block;">
              <h1>Vagarious Solutions Pvt Ltd</h1>
              <p>Spline Arcade 2nd Floor, Ayyappa Society Main Rd Sri Sai Nagar, Madhapur, Hyderabad, Telangana-500081</p>
            </div>
            <div class="payslip-tag">
              <h2>PAYSLIP</h2>
              <p>${new Date(periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          <div class="emp-details">
            <div>
              <div class="detail-row"><span class="label">Employee Name:</span><span class="val">${employee.employeeName}</span></div>
              <div class="detail-row"><span class="label">Employee ID:</span><span class="val">${employee.employeeId}</span></div>
              <div class="detail-row"><span class="label">Designation:</span><span class="val">${employee.role}</span></div>
            </div>
            <div>
              <div class="detail-row"><span class="label">Pay Period:</span><span class="val">${new Date(periodStart).toLocaleDateString()} to ${new Date(periodEnd).toLocaleDateString()}</span></div>
              <div class="detail-row"><span class="label">Working Days:</span><span class="val">${monthlyWorkingDays} Days</span></div>
              <div class="detail-row"><span class="label">Worked Days:</span><span class="val">${employee.totalWorkedDays} (${employee.fullDays}F + ${employee.halfDays}H)</span></div>
            </div>
          </div>

          <div class="content">
            <div class="col">
              <div class="col-header">Earnings</div>
              <div class="item-row"><span>Base Salary</span><span class="earning-val">${formatCurrency(currentBase)}</span></div>
              <div class="item-row"><span>Incentives / Bonus</span><span class="earning-val">${formatCurrency(currentIncentives)}</span></div>
              <!-- Add HRA/DA logic here if needed in future -->
              <div class="item-row" style="margin-top: 20px; border-top: 1px dashed #cbd5e1;"><span>Total Earnings</span><span>${formatCurrency(currentBase + currentIncentives)}</span></div>
            </div>
            <div class="col">
              <div class="col-header">Deductions</div>
              <div class="item-row"><span>Provident Fund (${pfPercentage}%)</span><span class="deduction-val">${formatCurrency(pfDeduction)}</span></div>
              <div class="item-row"><span>LOP (${employee.extraLeaves} Days)</span><span class="deduction-val">${formatCurrency(lopDeduction)}</span></div>
              <div class="item-row"><span>Other Deductions</span><span class="deduction-val">${formatCurrency(currentManualDed)}</span></div>
              <div class="item-row" style="margin-top: 20px; border-top: 1px dashed #cbd5e1;"><span>Total Deductions</span><span>${formatCurrency(pfDeduction + lopDeduction + currentManualDed)}</span></div>
            </div>
          </div>

          <div class="net-pay-section">
            <span class="net-pay-label">NET PAYABLE AMOUNT</span>
            <span class="net-pay-amount">${formatCurrency(netPayableSalary)}</span>
          </div>
          <div class="amount-words">
            ** Amount transferred to registered bank account
          </div>

          <div class="footer">
            <p>This is a computer-generated document and does not require a physical signature.</p>
            <p>For discrepancies, please contact HR at opos@gmail.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(payslipHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sticky top-0 z-10 flex justify-between items-center shadow-md">
          <div>
            <h2 className="text-2xl font-bold">Payroll Details</h2>
            <p className="text-blue-100 text-sm mt-1">{employee.employeeName} - {employee.employeeId}</p>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-4 rounded-lg text-sm shadow-sm">
                ✏️ Edit Salary
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleSave} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Save</button>
                <button onClick={() => setIsEditing(false)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Cancel</button>
              </div>
            )}
            <button onClick={onClose} className="text-white hover:bg-white hover:text-blue-600 rounded-full p-2 transition-all">✕</button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 bg-slate-50">
          
          {/* Employee Info Card */}
          <div className="bg-white rounded-lg p-6 mb-6 border border-slate-200 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-gray-500 font-bold uppercase">Department</div><div className="text-sm font-semibold text-gray-900 mt-1">{employee.department}</div></div>
              <div><div className="text-xs text-gray-500 font-bold uppercase">Role</div><div className="text-sm font-semibold text-gray-900 mt-1">{employee.role}</div></div>
              <div><div className="text-xs text-gray-500 font-bold uppercase">Working Days</div><div className="text-sm font-semibold text-gray-900 mt-1">{monthlyWorkingDays} days</div></div>
              <div><div className="text-xs text-gray-500 font-bold uppercase">PF Rate</div><div className="text-sm font-semibold text-gray-900 mt-1">{pfPercentage}%</div></div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">Attendance Summary</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-blue-50 rounded"><div className="text-xl font-bold text-blue-700">{employee.presentDays}</div><div className="text-[10px] uppercase text-blue-500 font-bold">Present</div></div>
                <div className="text-center p-2 bg-green-50 rounded"><div className="text-xl font-bold text-green-700">{employee.fullDays}</div><div className="text-[10px] uppercase text-green-500 font-bold">Full Days</div></div>
                <div className="text-center p-2 bg-yellow-50 rounded"><div className="text-xl font-bold text-yellow-700">{employee.halfDays}</div><div className="text-[10px] uppercase text-yellow-600 font-bold">Half Days</div></div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">Leave Analysis</h3>
              <div className="grid grid-cols-3 gap-3">
                 <div className="text-center p-2 bg-purple-50 rounded"><div className="text-xl font-bold text-purple-700">{employee.totalLeaveDays}</div><div className="text-[10px] uppercase text-purple-500 font-bold">Total Taken</div></div>
                 <div className="text-center p-2 bg-orange-50 rounded"><div className="text-xl font-bold text-orange-700">{employee.sandwichLeavesDays}</div><div className="text-[10px] uppercase text-orange-500 font-bold">Sandwich</div></div>
                 <div className="text-center p-2 bg-red-50 rounded"><div className="text-xl font-bold text-red-700">{employee.extraLeaves}</div><div className="text-[10px] uppercase text-red-500 font-bold">LOP Days</div></div>
              </div>
            </div>
          </div>

          {/* Salary Breakdown Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm mb-6">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-bold text-slate-700">Detailed Salary Breakdown</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-600">Base Salary (Monthly)</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {isEditing ? <input type="number" className="w-28 p-1 border rounded text-right" value={editValues.baseSalary} onChange={(e) => setEditValues({...editValues, baseSalary: e.target.value})} /> : formatCurrency(currentBase)}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                   <td className="px-4 py-3 text-slate-600">Per Day Salary</td>
                   <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(perDaySalary)}</td>
                </tr>
                <tr className="border-b border-slate-100 bg-green-50/50">
                   <td className="px-4 py-3 font-semibold text-green-800">Worked Salary ({employee.totalWorkedDays} days)</td>
                   <td className="px-4 py-3 text-right font-bold text-green-800">{formatCurrency(workedSalary)}</td>
                </tr>
                <tr className="border-b border-slate-100 bg-green-50/50">
                  <td className="px-4 py-3 text-green-700">Add: Incentives / Bonus</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {isEditing ? <input type="number" className="w-28 p-1 border border-green-300 rounded text-right" value={editValues.incentives} onChange={(e) => setEditValues({...editValues, incentives: e.target.value})} /> : `+ ${formatCurrency(currentIncentives)}`}
                  </td>
                </tr>
                <tr className="border-b border-slate-100 bg-red-50/50">
                  <td className="px-4 py-3 text-red-700">Less: PF Deduction ({pfPercentage}%)</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">- {formatCurrency(pfDeduction)}</td>
                </tr>
                <tr className="border-b border-slate-100 bg-red-50/50">
                  <td className="px-4 py-3 text-red-700">Less: LOP Deduction ({employee.extraLeaves} days)</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">- {formatCurrency(lopDeduction)}</td>
                </tr>
                <tr className="border-b border-slate-100 bg-red-50/50">
                  <td className="px-4 py-3 text-red-700">Less: Other Deductions</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700">
                    {isEditing ? <input type="number" className="w-28 p-1 border border-red-300 rounded text-right" value={editValues.manualDeductions} onChange={(e) => setEditValues({...editValues, manualDeductions: e.target.value})} /> : `- ${formatCurrency(currentManualDed)}`}
                  </td>
                </tr>
                <tr className="bg-slate-800 text-white">
                  <td className="px-4 py-4 text-base font-bold">NET PAYABLE</td>
                  <td className="px-4 py-4 text-right text-xl font-bold">{formatCurrency(netPayableSalary)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={downloadPayslip} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow transition flex items-center justify-center gap-2">
               📄 Download Payslip (PDF)
            </button>
            <button onClick={exportIndividualExcel} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow transition flex items-center justify-center gap-2">
               📊 Export to Excel
            </button>
            <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAYROLL MANAGEMENT COMPONENT ---
const PayrollManagement = () => {
  const [loading, setLoading] = useState(false); // Initially false, only loads on button click
  
  // Data State
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [shiftsMap, setShiftsMap] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // User Selection Dates (Control Inputs)
  const todayISO = new Date().toISOString().split("T")[0];
  const firstDayISO = new Date(new Date().setDate(1)).toISOString().split("T")[0];
  
  const [tempStartDate, setTempStartDate] = useState(firstDayISO);
  const [tempEndDate, setTempEndDate] = useState(todayISO);

  // Actual Fetch Dates (Control Logic)
  const [fetchStartDate, setFetchStartDate] = useState(firstDayISO);
  const [fetchEndDate, setFetchEndDate] = useState(todayISO);

  // Settings
  const [monthlyWorkingDays, setMonthlyWorkingDays] = useState(26);
  const [pfPercentage, setPfPercentage] = useState(12);
  const [payrollAdjustments, setPayrollAdjustments] = useState({});

  // 1. Fetch Data ONLY when fetchStartDate/EndDate changes (via Load Button)
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [leaves, employees, attendance, holidaysData, shifts] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
          getAttendanceByDateRange(fetchStartDate, fetchEndDate),
          getHolidays(),
          getAllShifts()
        ]);

        const sMap = {};
        const shiftList = Array.isArray(shifts) ? shifts : shifts.data || [];
        shiftList.forEach(s => { if(s.employeeId) sMap[s.employeeId] = s; });
        setShiftsMap(sMap);

        const formattedHolidays = holidaysData.map(h => ({
          ...h,
          start: normalize(h.startDate),
          end: normalize(h.endDate || h.startDate)
        }));
        setHolidays(formattedHolidays);

        setLeaveRequests(leaves);
        setAllEmployees(employees.filter(emp => emp.isActive !== false));
        setAttendanceData(Array.isArray(attendance) ? attendance : []);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [fetchStartDate, fetchEndDate]);

  // Handler for Load Data Button
  const handleLoadData = () => {
    setFetchStartDate(tempStartDate);
    setFetchEndDate(tempEndDate);
  };

  // --- LOGIC: SANDWICH LEAVES & STATS ---
  const calculateSandwich = useCallback((employeeId) => {
    const employeeLeaves = leaveRequests.filter(req => req.employeeId === employeeId);
    const rangeStart = new Date(fetchStartDate);
    const rangeEnd = new Date(fetchEndDate);
    const isDateInRange = (dStr) => { const d = new Date(dStr); return d >= rangeStart && d <= rangeEnd; };

    const approvedLeaves = employeeLeaves.filter(leave => leave.status === "Approved" && (isDateInRange(leave.from) || isDateInRange(leave.to)));
    
    // Build Map
    const bookedMap = new Map();
    let normalLeaveDays = 0;
    approvedLeaves.forEach(leave => {
       const duration = calculateLeaveDays(leave.from, leave.to);
       normalLeaveDays += duration;
       const isFullDay = !leave.halfDaySession;
       let curr = new Date(leave.from);
       const end = new Date(leave.to);
       while (curr <= end) {
         bookedMap.set(formatDate(curr), isFullDay);
         curr = addDays(curr, 1);
       }
    });

    let sandwichDays = 0;
    // Holidays
    holidays.forEach(holiday => {
      const hStart = new Date(holiday.start);
      if (!isDateInRange(formatDate(hStart))) return;
      const dayBefore = formatDate(addDays(hStart, -1));
      const dayAfter = formatDate(addDays(hStart, 1)); 
      if (bookedMap.get(dayBefore) === true && bookedMap.get(dayAfter) === true) sandwichDays++;
    });
    // Weekends (Simple Sat check)
    for (const [dateStr, isFullDay] of bookedMap.entries()) {
      if (!isFullDay || !isDateInRange(dateStr)) continue;
      const d = new Date(dateStr);
      if (d.getDay() === 6) { 
        const mondayStr = formatDate(addDays(d, 2));
        if (bookedMap.get(mondayStr) === true) sandwichDays++;
      }
    }
    return { totalConsumed: normalLeaveDays + sandwichDays, sandwichDays };
  }, [leaveRequests, holidays, fetchStartDate, fetchEndDate]);

  // --- LOGIC: PAYROLL CALCULATION ---
  const payrollData = useMemo(() => {
    if (!allEmployees.length) return [];

    return allEmployees.map(emp => {
      const empId = emp.employeeId;
      const shift = shiftsMap[empId];
      const targetHours = shift ? getShiftDurationInHours(shift.shiftStartTime, shift.shiftEndTime) : 9;

      // Attendance Stats
      const empAttendance = attendanceData.filter(a => a.employeeId === empId);
      let present = 0, full = 0, half = 0;
      empAttendance.forEach(att => {
        if(att.punchIn) present++;
        const status = getWorkedStatus(att.punchIn, att.punchOut, targetHours);
        if(status === "Full Day") full++; else if(status === "Half Day") half++;
      });
      const totalWorkedDays = full + (half * 0.5);

      // Leave Stats
      const leaveStats = calculateSandwich(empId);
      const monthlyCredit = 1; 
      const extraLeaves = Math.max(0, leaveStats.totalConsumed - monthlyCredit);

      // Adjustments (Edit Mode Values)
      const adj = payrollAdjustments[empId] || {};
      const currentExp = Array.isArray(emp.experienceDetails) ? emp.experienceDetails.find((exp) => exp.lastWorkingDate === "Present") : null;
      
      const baseSalary = adj.baseSalary !== undefined ? adj.baseSalary : (currentExp?.salary ? Number(currentExp.salary) : 0);
      const incentives = adj.incentives || 0;
      const manualDeductions = adj.manualDeductions || 0;

      const perDaySalary = baseSalary / monthlyWorkingDays;
      const workedSalary = totalWorkedDays * perDaySalary;
      const lopDeduction = extraLeaves * perDaySalary;
      const pfDeduction = baseSalary * (pfPercentage / 100);

      const netPayableSalary = workedSalary - lopDeduction - pfDeduction - manualDeductions + incentives;

      return {
        employeeId: empId,
        employeeName: emp.name || "Unknown",
        department: currentExp?.department || "N/A",
        role: currentExp?.role || "N/A",
        baseSalary,
        perDaySalary,
        presentDays: present,
        fullDays: full,
        halfDays: half,
        totalWorkedDays,
        totalLeaveDays: leaveStats.totalConsumed, 
        sandwichLeavesDays: leaveStats.sandwichDays,
        extraLeaves,
        incentives,
        manualDeductions,
        pfDeduction,
        lopDeduction,
        netPayableSalary
      };
    }).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [allEmployees, attendanceData, shiftsMap, calculateSandwich, payrollAdjustments, monthlyWorkingDays, pfPercentage]);

  const handleUpdatePayroll = (empId, newValues) => {
    setPayrollAdjustments(prev => ({ ...prev, [empId]: newValues }));
  };

  const handleExportAll = () => {
    const exportData = payrollData.map(emp => ({
       "ID": emp.employeeId, "Name": emp.employeeName, "Role": emp.role,
       "Base Salary": emp.baseSalary, 
       "Worked Days": emp.totalWorkedDays, "Full Days": emp.fullDays, "Half Days": emp.halfDays,
       "Leaves Taken": emp.totalLeaveDays, "Extra Leaves": emp.extraLeaves,
       "PF Deduction": emp.pfDeduction.toFixed(2), "LOP Deduction": emp.lopDeduction.toFixed(2),
       "Incentives": emp.incentives, "Other Ded": emp.manualDeductions,
       "Net Payable": emp.netPayableSalary.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = { Sheets: { data: ws }, SheetNames: ["Payroll_Summary"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    FileSaver.saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `Payroll_Summary_${fetchStartDate}.xlsx`);
  };

  const formatCurrency = (val) => `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const totals = payrollData.reduce((acc, emp) => ({
    base: acc.base + emp.baseSalary,
    worked: acc.worked + (emp.totalWorkedDays * emp.perDaySalary),
    lop: acc.lop + emp.lopDeduction,
    net: acc.net + emp.netPayableSalary,
    extraLeaves: acc.extraLeaves + emp.extraLeaves
  }), { base: 0, worked: 0, lop: 0, net: 0, extraLeaves: 0 });

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-[1800px] mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Payroll Management System</h1>
            <p className="text-gray-600">Period: <span className="font-semibold text-blue-600">{new Date(fetchStartDate).toLocaleDateString()}</span> to <span className="font-semibold text-blue-600">{new Date(fetchEndDate).toLocaleDateString()}</span></p>
          </div>
          <button onClick={handleExportAll} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transform transition hover:scale-105">
            <span>📥</span> Export Full Payroll
          </button>
        </div>

        {/* Control Panel (No Auto-Refresh) */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-bold text-gray-800">Payroll Configuration</h2>
             <button onClick={handleLoadData} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
               {loading ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> : "🔄 Load Data"}
             </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">From Date</label>
              <input type="date" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">To Date</label>
              <input type="date" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Working Days / Month</label>
              <input type="number" min="20" max="31" value={monthlyWorkingDays} onChange={(e) => setMonthlyWorkingDays(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">PF Rate (%)</label>
              <input type="number" min="0" max="50" value={pfPercentage} onChange={(e) => setPfPercentage(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Summary Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-gray-400 p-5">
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">Employees</div>
            <div className="text-2xl font-bold text-gray-900">{payrollData.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-5">
            <div className="text-xs font-bold text-blue-500 uppercase mb-1">Base Salaries</div>
            <div className="text-xl font-bold text-blue-900">{formatCurrency(totals.base)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-green-500 p-5">
            <div className="text-xs font-bold text-green-500 uppercase mb-1">Worked Salaries</div>
            <div className="text-xl font-bold text-green-900">{formatCurrency(totals.worked)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-5">
            <div className="text-xs font-bold text-red-500 uppercase mb-1">LOP Deductions</div>
            <div className="text-xl font-bold text-red-900">{formatCurrency(totals.lop)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 p-5">
            <div className="text-xs font-bold text-purple-500 uppercase mb-1">Total Net Payable</div>
            <div className="text-xl font-bold text-purple-900">{formatCurrency(totals.net)}</div>
          </div>
        </div>

        {/* Payroll Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
             <h3 className="font-bold text-gray-700">Detailed Payroll Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs leading-normal">
                <tr>
                  <th className="py-3 px-4 text-left font-bold">Employee</th>
                  <th className="py-3 px-4 text-center font-bold">Base Salary</th>
                  <th className="py-3 px-4 text-center font-bold">Total Worked</th>
                  <th className="py-3 px-4 text-center font-bold text-blue-600">Leaves</th>
                  <th className="py-3 px-4 text-center font-bold">Extra LOP</th>
                  <th className="py-3 px-4 text-center font-bold">PF ({pfPercentage}%)</th>
                  <th className="py-3 px-4 text-center font-bold">LOP Amt</th>
                  <th className="py-3 px-4 text-center font-bold bg-green-50 text-green-800">Net Pay</th>
                  <th className="py-3 px-4 text-center font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 text-sm">
                {loading ? (
                   <tr><td colSpan="9" className="py-8 text-center text-blue-600 font-bold">Loading data...</td></tr>
                ) : payrollData.length > 0 ? (
                  payrollData.map((emp) => (
                    <tr key={emp.employeeId} className="border-b border-gray-200 hover:bg-blue-50/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{emp.employeeName}</div>
                        <div className="text-xs text-gray-500">{emp.employeeId}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium">{formatCurrency(emp.baseSalary)}</td>
                      
                      {/* FEATURE: Description in Total Worked Column */}
                      <td className="py-3 px-4 text-center">
                        <div className="font-bold text-blue-800 bg-blue-100 rounded-full px-2 inline-block mb-1">{emp.totalWorkedDays.toFixed(1)}</div>
                        <div className="text-[10px] text-gray-500 font-medium">({emp.fullDays} Full + {emp.halfDays} Half)</div>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-blue-600">{emp.totalLeaveDays}</td>
                      <td className="py-3 px-4 text-center">
                         <span className={`px-2 py-1 rounded text-xs font-bold ${emp.extraLeaves > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{emp.extraLeaves}</span>
                      </td>
                      <td className="py-3 px-4 text-center text-red-600 font-medium">-{formatCurrency(emp.pfDeduction)}</td>
                      <td className="py-3 px-4 text-center text-red-600 font-medium">{emp.lopDeduction > 0 ? `-${formatCurrency(emp.lopDeduction)}` : '-'}</td>
                      <td className="py-3 px-4 text-center font-bold text-green-800 bg-green-50/50">{formatCurrency(emp.netPayableSalary)}</td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => setSelectedEmployee(emp)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow transition">
                          View / Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="9" className="py-8 text-center text-gray-500">No data found. Click "Load Data".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <PayrollSlipModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          monthlyWorkingDays={monthlyWorkingDays}
          periodStart={fetchStartDate}
          periodEnd={fetchEndDate}
          onUpdatePayroll={handleUpdatePayroll}
          pfPercentage={pfPercentage}
        />
      )}
    </div>
  );
};

export default PayrollManagement;