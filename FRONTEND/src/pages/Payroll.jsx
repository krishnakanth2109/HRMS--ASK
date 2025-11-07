import React, { useState } from "react";
import { Document, Packer, Paragraph, Table, TableRow, TableCell } from "docx";
import { saveAs } from "file-saver";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

export default function PayrollModule() {
  // ---------------- Employees ----------------
  const [employees, setEmployees] = useState([
    { id: 1, name: "Amit Kumar", designation: "Developer", department: "IT", basic: 30000, hra: 6000, allowances: 2000, pfPercent: 12, esiPercent: 1.75, tdsPercent: 5, gstPercent: 2 },
    { id: 2, name: "Sita Sharma", designation: "HR", department: "HR", basic: 25000, hra: 5000, allowances: 1500, pfPercent: 12, esiPercent: 1.75, tdsPercent: 3, gstPercent: 2 },
  ]);

  const [month, setMonth] = useState(() => {
    const m = new Date();
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
  });

  const [attendance, setAttendance] = useState({
    1: { present: 22, absent: 2, overtime: 5, lop: 0 },
    2: { present: 20, absent: 4, overtime: 2, lop: 1 },
  });

  const [adjustments, setAdjustments] = useState({
    1: { bonus: 2000, loan: 0 },
    2: { bonus: 0, loan: 500 },
  });

  const [processed, setProcessed] = useState({});
  const [finalizedForMonth, setFinalizedForMonth] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "", designation: "", department: "", basic: 0, hra: 0, allowances: 0,
    pfPercent: 12, esiPercent: 1.75, tdsPercent: 0, gstPercent: 0
  });

  const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  // ---------------- Payroll Calculation ----------------
  const calculateForEmployee = (emp) => {
    const att = attendance[emp.id] || { present: 0, absent: 0, overtime: 0, lop: 0 };
    const adj = adjustments[emp.id] || { bonus: 0, loan: 0 };
    const gross = emp.basic + emp.hra + emp.allowances + adj.bonus;
    const overtimePay = (emp.basic * 0.01) * (att.overtime || 0);
    const workingDays = 26;
    const lopDeduction = (gross / workingDays) * (att.lop || 0);

    const pf = emp.basic * (emp.pfPercent / 100);
    const esi = gross * (emp.esiPercent / 100);
    const tds = gross * (emp.tdsPercent / 100);
    const gst = gross * (emp.gstPercent / 100);
    const loan = adj.loan || 0;

    const totalDeductions = pf + esi + tds + gst + loan + lopDeduction;
    const net = gross + overtimePay - totalDeductions;

    return {
      employeeId: emp.id,
      name: emp.name,
      designation: emp.designation,
      department: emp.department || "N/A",
      month,
      earnings: { BASIC: emp.basic, HRA: emp.hra, ALLOWANCES: emp.allowances, BONUS: adj.bonus, "OVERTIME PAY": round(overtimePay) },
      deductions: { PF: round(pf), ESI: round(esi), TDS: round(tds), GST: round(gst), LOAN: round(loan), "LOP DEDUCTION": round(lopDeduction) },
      gross: round(gross),
      totalDeductions: round(totalDeductions),
      net: round(net),
    };
  };

  const processPayroll = () => {
    const results = {};
    employees.forEach((e) => { results[e.id] = calculateForEmployee(e); });
    setProcessed((prev) => ({ ...prev, [month]: results }));
    alert("PAYROLL PROCESSED FOR " + month.toUpperCase());
  };

  const finalizePayroll = () => {
    if (!processed[month]) { alert("PLEASE PROCESS PAYROLL BEFORE FINALIZING."); return; }
    setFinalizedForMonth((prev) => ({ ...prev, [month]: processed[month] }));
    alert("PAYROLL FINALIZED FOR " + month.toUpperCase());
  };

  const generateWord = (empId) => {
    const record = (finalizedForMonth[month] || processed[month] || {})[empId];
    if (!record) { alert("PAYROLL NOT PROCESSED/FINALIZED FOR THIS EMPLOYEE FOR " + month.toUpperCase()); return; }

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "PAYSLIP", heading: "Title", alignment: "CENTER" }),
          new Paragraph({ text: `EMPLOYEE: ${record.name.toUpperCase()}` }),
          new Paragraph({ text: `DESIGNATION: ${record.designation.toUpperCase()}` }),
          new Paragraph({ text: `DEPARTMENT: ${record.department.toUpperCase()}` }),
          new Paragraph({ text: `MONTH: ${record.month.toUpperCase()}` }),
          new Paragraph({ text: "EARNINGS", spacing: { before: 200, after: 100 } }),
          new Table({
            rows: Object.entries(record.earnings).map(([k, v]) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(k.toUpperCase())] }),
                  new TableCell({ children: [new Paragraph(`₹${v}`)] }),
                ],
              })
            )
          }),
          new Paragraph({ text: "DEDUCTIONS", spacing: { before: 200, after: 100 } }),
          new Table({
            rows: Object.entries(record.deductions).map(([k, v]) =>
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(k.toUpperCase())] }),
                  new TableCell({ children: [new Paragraph(`₹${v}`)] }),
                ],
              })
            )
          }),
          new Paragraph({ text: `GROSS SALARY: ₹${record.gross}` }),
          new Paragraph({ text: `TOTAL DEDUCTIONS: ₹${record.totalDeductions}` }),
          new Paragraph({ text: `NET PAY: ₹${record.net}` }),
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => saveAs(blob, `PAYSLIP_${record.name}_${month}.docx`));
  };

  // ---------------- Dashboard Metrics ----------------
  const totalDepartments = new Set(employees.map(e => e.department)).size;
  const totalEmployees = employees.length;
  const netSalary = Object.values(processed[month] || {}).reduce((acc, val) => acc + val.net, 0);
  const payDay = new Date(new Date().getFullYear(), new Date().getMonth(), 30).toLocaleDateString();

  const salaryRanges = [
    { range: "<20000", count: employees.filter(e => e.basic < 20000).length },
    { range: "20000-30000", count: employees.filter(e => e.basic >= 20000 && e.basic <= 30000).length },
    { range: "30001-40000", count: employees.filter(e => e.basic >= 30001 && e.basic <= 40000).length },
    { range: ">40000", count: employees.filter(e => e.basic > 40000).length },
  ];

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.department || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 font-sans bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 min-h-screen">
      <h2 className="text-4xl font-extrabold mb-6 text-center text-purple-700">PAYROLL DASHBOARD</h2>

      {/* ---------------- Dashboard Cards ---------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-lg text-center">
          <h4 className="font-bold">TOTAL DEPARTMENTS</h4>
          <p className="text-2xl">{totalDepartments}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-lg text-center">
          <h4 className="font-bold">TOTAL EMPLOYEES</h4>
          <p className="text-2xl">{totalEmployees}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-lg text-center">
          <h4 className="font-bold">NET SALARY</h4>
          <p className="text-2xl">₹{netSalary}</p>
        </div>
      </div>

      {/* ---------------- Salary Range Chart ---------------- */}
      <div className="bg-white p-4 rounded-xl shadow-lg mb-6">
        <h4 className="font-bold mb-2">EMPLOYEES BY SALARY RANGE</h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={salaryRanges} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ---------------- Payroll Actions ---------------- */}
      <div className="mb-6 flex flex-wrap items-center gap-4 justify-center">
        <input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} className="border px-3 py-2 rounded-lg shadow-inner"/>
        <button onClick={processPayroll} className="bg-purple-500 text-white px-5 py-2 rounded-full shadow-lg hover:bg-purple-600 transition">PROCESS PAYROLL</button>
        <button onClick={finalizePayroll} className="bg-green-500 text-white px-5 py-2 rounded-full shadow-lg hover:bg-green-600 transition">FINALIZE PAYROLL</button>
        <input type="text" placeholder="SEARCH EMPLOYEE" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="border px-3 py-2 rounded-lg shadow-inner"/>
        <button onClick={()=>setShowAddModal(true)} className="bg-blue-500 text-white px-5 py-2 rounded-full shadow-lg hover:bg-blue-600 transition">ADD EMPLOYEE</button>
      </div>

      {/* ---------------- Employee Cards ---------------- */}
      {filteredEmployees.map(emp => {
        const record = (finalizedForMonth[month] || processed[month] || {})[emp.id];
        const status = finalizedForMonth[month]?.[emp.id] ? "FINALIZED" : record ? "PROCESSED" : "PENDING";
        return (
          <div key={emp.id} className="mb-6 p-6 border rounded-3xl shadow-2xl bg-white hover:shadow-3xl transition">
            <h4 className="text-2xl font-bold text-purple-700 mb-2">{emp.name.toUpperCase()} ({emp.designation.toUpperCase()})</h4>
            <p className="text-gray-500 mb-2">DEPARTMENT: {emp.department.toUpperCase()}</p>
            <p className="text-gray-500 mb-2">BASIC: ₹{emp.basic} | HRA: ₹{emp.hra} | ALLOWANCES: ₹{emp.allowances}</p>

            <div className="flex flex-wrap gap-4 mb-4">
              {["present","overtime","lop"].map(f => (
                <label key={f} className="flex flex-col text-gray-600">
                  {f.toUpperCase()}:
                  <input type="number" value={(attendance[emp.id]||{})[f]||0} onChange={e=>setAttendance(prev=>({...prev,[emp.id]:{...(prev[emp.id]||{}),[f]:Number(e.target.value)}}))} className="border px-2 py-1 w-24 rounded-lg shadow-inner focus:ring-2 focus:ring-purple-300"/>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              {["bonus","loan"].map(f => (
                <label key={f} className="flex flex-col text-gray-600">
                  {f.toUpperCase()}:
                  <input type="number" value={(adjustments[emp.id]||{})[f]||0} onChange={e=>setAdjustments(prev=>({...prev,[emp.id]:{...(prev[emp.id]||{}),[f]:Number(e.target.value)}}))} className="border px-2 py-1 w-24 rounded-lg shadow-inner focus:ring-2 focus:ring-purple-300"/>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-4 mt-3">
              <button onClick={()=>generateWord(emp.id)} className="bg-orange-500 text-white px-5 py-2 rounded-full shadow-lg hover:bg-orange-600 transition">DOWNLOAD WORD</button>
              {record && <span className={`px-2 py-1 rounded-full ${status==="FINALIZED"?"bg-green-200 text-green-800":"bg-yellow-200 text-yellow-800"}`}>NET: ₹{record.net} | {status}</span>}
            </div>
          </div>
        );
      })}

      {/* ---------------- Add Employee Modal ---------------- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-2xl w-[400px]">
            <h3 className="text-xl font-bold mb-4">ADD NEW EMPLOYEE</h3>
            {["name","designation","department","basic","hra","allowances","pfPercent","esiPercent","tdsPercent","gstPercent"].map(k => (
              <div key={k} className="mb-3 flex flex-col">
                <label className="text-gray-700">{k.toUpperCase()}</label>
                <input type={["basic","hra","allowances","pfPercent","esiPercent","tdsPercent","gstPercent"].includes(k)?"number":"text"} value={newEmployee[k]} onChange={e=>setNewEmployee(prev=>({...prev,[k]: ["basic","hra","allowances","pfPercent","esiPercent","tdsPercent","gstPercent"].includes(k)?Number(e.target.value):e.target.value}))} className="border px-2 py-1 rounded-lg"/>
              </div>
            ))}
            <div className="flex justify-end gap-4 mt-4">
              <button onClick={()=>setShowAddModal(false)} className="px-4 py-2 rounded-full border">CANCEL</button>
              <button onClick={()=>{
                setEmployees(prev=>[...prev,{...newEmployee,id:prev.length+1}]);
                setNewEmployee({ name: "", designation: "", department: "", basic: 0, hra: 0, allowances: 0, pfPercent: 12, esiPercent: 1.75, tdsPercent:0, gstPercent:0 });
                setShowAddModal(false);
              }} className="px-4 py-2 rounded-full bg-blue-500 text-white">ADD</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
