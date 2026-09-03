import { useState, useEffect } from 'react';
import { getAdminShifts, getStaff, getStaffPayroll, updateStaffPayroll } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { Timer, Search, Calendar, User, DollarSign, Clock, AlertTriangle, CheckCircle, RefreshCw, ArrowUpRight, ArrowDownRight, ShieldCheck, Wallet, Coins, ChefHat, Bike, CreditCard, Download } from 'lucide-react';

const getPayrollPeriod = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = date.getMonth();
  if (date.getDate() <= 15) {
    return { start: new Date(year, month, 1), end: new Date(year, month, 15, 23, 59, 59, 999) };
  }
  return { start: new Date(year, month, 16), end: new Date(year, month + 1, 0, 23, 59, 59, 999) };
};

const payrollRoles = ['cashier', 'kitchen', 'rider'];

export default function ShiftsTab() {
  const [shifts, setShifts] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [payrollPayments, setPayrollPayments] = useState([]);
  const [showPayrollSummary, setShowPayrollSummary] = useState(false);
  const [payrollConfirmation, setPayrollConfirmation] = useState(null);

  // Hourly Rate States
  const [cashierRate, setCashierRate] = useState(() => parseFloat(localStorage.getItem('hourly_rate_cashier')) || 75);
  const [kitchenRate, setKitchenRate] = useState(() => parseFloat(localStorage.getItem('hourly_rate_kitchen')) || 80);
  const [riderRate, setRiderRate] = useState(() => parseFloat(localStorage.getItem('hourly_rate_rider')) || 85);

  const handleRateChange = (role, val) => {
    const num = parseFloat(val) || 0;
    if (role === 'cashier') {
      setCashierRate(num);
      localStorage.setItem('hourly_rate_cashier', num);
    } else if (role === 'kitchen') {
      setKitchenRate(num);
      localStorage.setItem('hourly_rate_kitchen', num);
    } else if (role === 'rider') {
      setRiderRate(num);
      localStorage.setItem('hourly_rate_rider', num);
    }
  };

  const getShiftHours = (start, end) => {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diffMs = e - s;
    if (diffMs <= 0) return 0;
    return diffMs / (1000 * 60 * 60);
  };

  const calculateSalary = (shift) => {
    const hours = getShiftHours(shift.startTime, shift.endTime);
    const role = shift.role || 'cashier';
    const rate = role === 'kitchen' ? kitchenRate : role === 'rider' ? riderRate : cashierRate;
    return hours * rate;
  };

  const markStaffPayrollPaid = async (group) => {
    const completedShifts = group.shifts.filter(shift => shift.status !== 'active');
    if (!group.staffId || completedShifts.length === 0) return;
    const latestShift = completedShifts.reduce((latest, shift) => new Date(shift.startTime) > new Date(latest.startTime) ? shift : latest, completedShifts[0]);
    const period = getPayrollPeriod(latestShift.startTime);
    const grossSalary = completedShifts.reduce((total, shift) => total + calculateSalary(shift), 0);
    const shortage = completedShifts.reduce((total, shift) => total + Math.max(0, -(Number(shift.cashDifference) || 0)), 0);
    const netSalary = Math.max(0, grossSalary - shortage);
    setPayrollConfirmation({ group, period, grossSalary, shortage, netSalary });
  };

  const confirmPayrollPayment = async () => {
    if (!payrollConfirmation) return;
    const { group, period, grossSalary, shortage, netSalary } = payrollConfirmation;
    try {
      await updateStaffPayroll(group.staffId, {
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        status: 'paid',
        amount: netSalary,
        grossAmount: grossSalary,
        deductionAmount: shortage,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'cash',
        note: 'Paid from Payroll Summary'
      });
      setPayrollConfirmation(null);
      await loadShifts();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to mark staff payroll as paid.');
    }
  };

  useEffect(() => {
    loadShifts();
  }, [statusFilter, roleFilter, startDate, endDate]);

  const loadShifts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (roleFilter !== 'all') params.role = roleFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await getAdminShifts(params);
      setShifts(res.data.data.shifts || []);
      setSummary(res.data.data.summary || null);

      try {
        const staffRes = await getStaff();
        setStaffMembers((staffRes.data.data || []).filter(member => payrollRoles.includes(member.role) && member.active !== false));
      } catch (staffError) {
        console.error('Failed to load staff roster:', staffError);
        setStaffMembers([]);
      }

      const period = getPayrollPeriod(startDate || endDate || new Date());
      try {
        const payrollRes = await getStaffPayroll({
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString()
        });
        setPayrollPayments(payrollRes.data.data || []);
      } catch (payrollError) {
        console.error('Failed to load payroll records:', payrollError);
        setPayrollPayments([]);
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getShiftDuration = (start, end) => {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diffMs = e - s;
    if (diffMs <= 0) return '0m';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const filteredShifts = shifts.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.cashierName?.toLowerCase().includes(q) || s.user?.name?.toLowerCase().includes(q) || s.user?.email?.toLowerCase().includes(q);
  });

  const payrollPeriod = getPayrollPeriod(startDate || endDate || new Date());
  const payrollShifts = filteredShifts.filter(shift => {
    const shiftDate = new Date(shift.startTime);
    return shiftDate >= payrollPeriod.start && shiftDate <= payrollPeriod.end;
  });

  const staffSearchMatches = (member) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return member.name?.toLowerCase().includes(q) || member.email?.toLowerCase().includes(q);
  };

  const payrollGroups = Object.values(staffMembers
    .filter(member => (roleFilter === 'all' || member.role === roleFilter) && staffSearchMatches(member))
    .reduce((groups, member) => {
      groups[member.id] = {
        staffId: member.id,
        name: member.name || 'Staff',
        role: member.role || 'staff',
        shifts: []
      };
      return groups;
    }, {}));

  payrollShifts.forEach(shift => {
    const staffId = shift.userId || shift.user?.id;
    if (!staffId) return;
    const group = payrollGroups.find(item => item.staffId === staffId);
    if (group) group.shifts.push(shift);
  });

  const exportCSV = () => {
    if (filteredShifts.length === 0) return alert('No shift records to export.');

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['Staff Name', 'Email', 'Role', 'Status', 'Time In', 'Time Out', 'Duration', 'Hours Worked', 'Hourly Rate', 'Est. Salary', 'Opening Float', 'Cash Sales', 'Online Sales', 'Total Sales', 'Orders', 'Expected Drawer', 'Counted Ending', 'Variance', 'Notes'];

    const rows = filteredShifts.map(s => {
      const hours = getShiftHours(s.startTime, s.endTime);
      const role = s.role || 'cashier';
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
      const statusLabel = s.status === 'active' ? 'Active' : s.status === 'closed' ? 'Timed Out' : (s.status || '');
      const rate = role === 'kitchen' ? kitchenRate : role === 'rider' ? riderRate : cashierRate;
      const salary = hours * rate;

      return [
        s.cashierName || s.user?.name || '',
        s.user?.email || '',
        roleLabel,
        statusLabel,
        s.startTime ? new Date(s.startTime).toLocaleString() : '',
        s.endTime ? new Date(s.endTime).toLocaleString() : 'In Progress',
        getShiftDuration(s.startTime, s.endTime),
        hours.toFixed(2),
        rate,
        salary.toFixed(2),
        s.startingCash ?? '',
        s.cashSales ?? '',
        s.onlineSales ?? '',
        s.totalSales ?? '',
        s.orderCount ?? '',
        s.expectedCash ?? '',
        s.endingCash ?? '',
        s.cashDifference ?? '',
        s.notes || ''
      ].map(escapeCSV).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `staff-shifts-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate total salary payout
  const totalPayout = filteredShifts.reduce((acc, s) => acc + calculateSalary(s), 0);

  return (
    <div className="space-y-5 lg:space-y-6 animate-fade-in min-w-0">
      {payrollConfirmation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="bg-slate-900 px-6 py-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Confirm Payroll</p>
              <h3 className="mt-1 font-heading text-2xl font-black">Mark salary as paid?</h3>
              <p className="mt-1 text-sm text-slate-300">This payment will be recorded for {payrollConfirmation.group.name}.</p>
            </div>
            <div className="space-y-3 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-500">Gross salary</span>
                  <span className="font-black text-slate-900">{formatCurrency(payrollConfirmation.grossSalary)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-500">Shortage deduction</span>
                  <span className="font-black text-rose-600">{formatCurrency(payrollConfirmation.shortage)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="font-black text-slate-900">Final amount to pay</span>
                  <span className="text-xl font-black text-emerald-600">{formatCurrency(payrollConfirmation.netSalary)}</span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">The salary and any shortage deduction will be saved for this pay period.</p>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setPayrollConfirmation(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={confirmPayrollPayment} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">Confirm Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPayrollSummary && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
            <div className="flex items-start justify-between gap-4 p-6 sm:p-8 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Payroll Overview</p>
                <h3 className="font-heading text-2xl sm:text-3xl font-black text-slate-900">Staff Salary Summary</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Review each staff member's shifts and mark completed payroll payments.</p>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-2">Pay period: {payrollPeriod.start.toLocaleDateString()} - {payrollPeriod.end.toLocaleDateString()}</p>
              </div>
              <button type="button" onClick={() => setShowPayrollSummary(false)} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 text-xl leading-none">&times;</button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-150px)] space-y-3">
              {payrollGroups.map(group => {
                const completedShifts = group.shifts.filter(shift => shift.status !== 'active');
                const estimatedTotal = completedShifts.reduce((total, shift) => total + calculateSalary(shift), 0);
                const shortage = completedShifts.reduce((total, shift) => total + Math.max(0, -(Number(shift.cashDifference) || 0)), 0);
                const netTotal = Math.max(0, estimatedTotal - shortage);
                const payrollPayment = payrollPayments.find(payment => payment.userId === group.staffId);
                const isPaid = payrollPayment?.status === 'paid';
                const paidTotal = isPaid ? Number(payrollPayment.amount || 0) : 0;
                const hasUnpaidPayroll = !isPaid && completedShifts.length > 0;
                const payrollStatus = isPaid ? 'Paid' : hasUnpaidPayroll ? 'Not Yet Paid' : 'No Shifts';

                return (
                  <div key={`${group.name}-${group.role}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0">
                        <h4 className="font-heading text-lg font-black text-slate-900 truncate">{group.name}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.role} · {completedShifts.length} timed-out shift{completedShifts.length === 1 ? '' : 's'}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:flex-1">
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5 sm:text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gross Salary</p>
                          <p className="font-black text-slate-900">{formatCurrency(estimatedTotal)}</p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5 sm:text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Pay</p>
                          <p className="font-black text-emerald-600">{formatCurrency(netTotal)}</p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5 sm:text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deduction</p>
                          <p className="font-black text-rose-600">{formatCurrency(shortage)}</p>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5 sm:text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payroll Status</p>
                          <p className={`font-black ${isPaid ? 'text-emerald-600' : hasUnpaidPayroll ? 'text-amber-600' : 'text-slate-400'}`}>{payrollStatus}</p>
                        </div>
                        <button type="button" onClick={() => markStaffPayrollPaid(group)} disabled={!hasUnpaidPayroll} className="w-full min-h-[56px] sm:col-span-4 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
                          {isPaid ? 'Paid' : hasUnpaidPayroll ? (shortage > 0 ? 'Approve & Pay' : 'Mark Salary Paid') : 'No Salary'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {group.shifts.map(shift => (
                        <div key={shift.id} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-100 px-3 py-2.5 text-xs">
                          <span className="text-slate-500">{formatDate(shift.startTime)} · {getShiftDuration(shift.startTime, shift.endTime)}</span>
                          <span className="font-bold text-slate-800">{formatCurrency(calculateSalary(shift))}</span>
                          <span className={`text-[9px] font-black uppercase ${shift.status === 'active' ? 'text-blue-600' : isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {shift.status === 'active' ? 'Active' : isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {paidTotal > 0 && <p className="text-[10px] text-emerald-600 font-semibold mt-3">Total paid for this period: {formatCurrency(paidTotal)}</p>}
                  </div>
                );
              })}
              {payrollGroups.length === 0 && <p className="text-center text-slate-400 py-12 font-medium">No staff shifts found for this filter.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Header & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black font-heading text-slate-900">
            Staff Shifts & Attendance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 max-w-2xl">
            Track all staff attendance, shift durations, and cashier cash register audit.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-[390px]">
          <button
            onClick={() => setShowPayrollSummary(true)}
            disabled={filteredShifts.length === 0}
            className="w-full lg:w-auto justify-center px-3 sm:px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white rounded-2xl text-xs font-black shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Wallet className="w-4 h-4" />
            Payroll Summary
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredShifts.length === 0}
            className="w-full lg:w-auto justify-center px-3 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white rounded-2xl text-xs font-black shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={loadShifts}
            disabled={loading}
            className="w-full lg:w-auto justify-center px-3 sm:px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs font-black text-slate-700 shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 lg:gap-4">
          <div className="glass-card p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-sm min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Shifts</span>
            </div>
            <p className="text-xl font-black text-slate-900 font-heading">{summary.totalShifts}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold">
              <span className="text-emerald-600">{summary.activeShiftsCount} Active</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{summary.closedShiftsCount} Timed Out</span>
            </div>
          </div>

          <div className="glass-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Floats</span>
            </div>
            <p className="text-xl font-black text-slate-900 font-heading">{formatCurrency(summary.totalStartingCash)}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Total initial float</p>
          </div>

          <div className="glass-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cash Sales</span>
            </div>
            <p className="text-xl font-black text-emerald-600 font-heading">{formatCurrency(summary.totalCashSales)}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Physical drawer cash</p>
          </div>

          <div className="glass-card p-4 bg-white rounded-2xl border border-blue-100 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Online Sales</span>
            </div>
            <p className="text-xl font-black text-blue-600 font-heading">{formatCurrency(summary.totalOnlineSales || 0)}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">GCash / Maya</p>
          </div>

          <div className="glass-card p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Discrepancy</span>
            </div>
            <p className={`text-xl font-black font-heading ${summary.totalDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {summary.totalDifference >= 0 ? '+' : ''}{formatCurrency(summary.totalDifference)}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              {summary.totalDifference === 0 ? 'Exact match' : summary.totalDifference > 0 ? 'Drawer surplus' : 'Drawer shortage'}
            </p>
          </div>

          <div className="glass-card p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Est. Total Payout</span>
            </div>
            <p className="text-xl font-black text-emerald-700 font-heading">{formatCurrency(totalPayout)}</p>
            <p className="text-[11px] text-emerald-600/90 font-bold mt-1">For {filteredShifts.length} shifts</p>
          </div>
        </div>
      )}

      {/* Hourly Wage Settings Panel */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Salary Calculator Settings</h4>
          <p className="text-[11px] text-slate-500 font-semibold">Define hourly rates for each role to estimate salaries instantly.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-600">Cashier:</span>
            <div className="flex items-center">
              <span className="text-xs text-slate-400 font-bold mr-0.5">₱</span>
              <input
                type="number"
                value={cashierRate}
                onChange={(e) => handleRateChange('cashier', e.target.value)}
                className="w-12 text-xs font-black text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-400 font-semibold">/hr</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-600">Kitchen:</span>
            <div className="flex items-center">
              <span className="text-xs text-slate-400 font-bold mr-0.5">₱</span>
              <input
                type="number"
                value={kitchenRate}
                onChange={(e) => handleRateChange('kitchen', e.target.value)}
                className="w-12 text-xs font-black text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-400 font-semibold">/hr</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-600">Rider:</span>
            <div className="flex items-center">
              <span className="text-xs text-slate-400 font-bold mr-0.5">₱</span>
              <input
                type="number"
                value={riderRate}
                onChange={(e) => handleRateChange('rider', e.target.value)}
                className="w-12 text-xs font-black text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-400 font-semibold">/hr</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative sm:col-span-2 lg:col-span-1 flex-1 min-w-0 lg:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by staff name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary-500 focus:bg-white"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Roles</option>
            <option value="cashier">Cashier</option>
            <option value="kitchen">Kitchen</option>
            <option value="rider">Rider</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only (Currently Timed In)</option>
            <option value="closed">Timed Out</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold whitespace-nowrap">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Date Range:</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full min-w-0 py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary-500"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full min-w-0 py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary-500"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="sm:col-span-4 justify-self-end text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
            <p className="text-sm font-semibold">Loading shifts and cash register logs...</p>
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="font-bold text-slate-700 text-base">No shift records found</p>
            <p className="text-xs text-slate-400 mt-1">Shifts will appear here when staff Time In on their dashboards.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-4">Staff</th>
                  <th className="py-4 px-4">Role</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-4">Time In</th>
                  <th className="py-4 px-4">Time Out</th>
                  <th className="py-4 px-4">Duration</th>
                  <th className="py-4 px-4 text-right">Hours</th>
                  <th className="py-4 px-4 text-right">Est. Salary</th>
                  <th className="py-4 px-4 text-right">Opening Float</th>
                  <th className="py-4 px-4 text-right">Cash Sales</th>
                  <th className="py-4 px-4 text-right">Online Sales</th>
                  <th className="py-4 px-4 text-right">Total Sales</th>
                  <th className="py-4 px-4 text-right">Expected Drawer</th>
                  <th className="py-4 px-4 text-right">Counted Ending</th>
                  <th className="py-4 px-4 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredShifts.map((s) => {
                  const isActive = s.status === 'active';
                  const variance = s.cashDifference || 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2 min-w-[190px]">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div>{s.cashierName || s.user?.name || 'Staff'}</div>
                            {s.user?.email && <div className="text-[10px] text-slate-400 font-normal">{s.user.email}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {(() => {
                          const role = s.role || 'cashier';
                          const roleConfig = {
                            cashier: { label: 'Cashier', bg: 'bg-blue-50 border-blue-200 text-blue-700', icon: <CreditCard className="w-3 h-3" /> },
                            kitchen: { label: 'Kitchen', bg: 'bg-amber-50 border-amber-200 text-amber-700', icon: <ChefHat className="w-3 h-3" /> },
                            rider:   { label: 'Rider',   bg: 'bg-violet-50 border-violet-200 text-violet-700', icon: <Bike className="w-3 h-3" /> },
                          };
                          const cfg = roleConfig[role] || roleConfig.cashier;
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full font-bold text-[10px] uppercase tracking-wider ${cfg.bg}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="py-4 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-black text-[10px] uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-bold text-[10px] uppercase tracking-wider">
                            <CheckCircle className="w-3 h-3 text-slate-400" /> Timed Out
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {formatDate(s.startTime)}
                      </td>

                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {s.endTime ? formatDate(s.endTime) : (
                          <span className="text-emerald-600 font-bold italic">In Progress</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-500 font-mono">
                        {getShiftDuration(s.startTime, s.endTime)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-700">
                        {getShiftHours(s.startTime, s.endTime).toFixed(2)} hrs
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(calculateSalary(s))}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(s.startingCash)}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-600">
                        {s.cashSales !== null ? formatCurrency(s.cashSales) : '—'}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold text-blue-600">
                        {s.onlineSales !== null ? formatCurrency(s.onlineSales) : '—'}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-black text-slate-900">
                        {s.totalSales !== null ? formatCurrency(s.totalSales) : '—'}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-800">
                        {s.expectedCash !== null ? formatCurrency(s.expectedCash) : '—'}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                        {s.endingCash !== null ? formatCurrency(s.endingCash) : (
                          <span className="text-slate-400 font-normal italic">Pending</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right font-mono font-bold">
                        {isActive ? (
                          <span className="text-slate-400 font-normal">—</span>
                        ) : (
                          <span className={variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-slate-700'}>
                            {variance > 0 ? `+${formatCurrency(variance)}` : formatCurrency(variance)}
                            {variance > 0 && <span className="block text-[9px] text-emerald-500 font-semibold uppercase">Surplus</span>}
                            {variance < 0 && <span className="block text-[9px] text-rose-500 font-semibold uppercase">Shortage</span>}
                            {variance === 0 && <span className="block text-[9px] text-slate-400 font-semibold uppercase">Exact</span>}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
