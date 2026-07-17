import { useState, useEffect } from 'react';
import { getDailyReport, getBestsellers, getKitchenTimes, getForecasting, getSalesByDate } from '../../services/api';
import { formatCurrency } from '../../utils/helpers';
import { Sparkles, AlertTriangle, LineChart, CalendarDays, Trophy, ChefHat, Search, ShoppingBag, Package } from 'lucide-react';

export default function ReportsTab() {
  const [dailyData, setDailyData] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [kitchenData, setKitchenData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  // Daily Sales by Date state
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dateReport, setDateReport] = useState(null);
  const [dateLoading, setDateLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadDateReport(selectedDate);
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dailyRes, bestRes, kitchenRes, forecastRes] = await Promise.all([
        getDailyReport(7),
        getBestsellers(),
        getKitchenTimes(),
        getForecasting()
      ]);
      setDailyData(dailyRes.data.data);
      setBestsellers(bestRes.data.data);
      setKitchenData(kitchenRes.data.data);
      setForecast(forecastRes.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadDateReport = async (date) => {
    setDateLoading(true);
    try {
      const res = await getSalesByDate(date);
      setDateReport(res.data.data);
    } catch (error) {
      console.error(error);
      setDateReport(null);
    } finally {
      setDateLoading(false);
    }
  };


  if (loading) return <div className="p-8 text-center text-surface-500">Generating analytics...</div>;

  return (
    <div className="animate-fade-in-up space-y-8">

      {/* ── Sales by Date ─────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-surface-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary-500" /> Sales by Date
            </h2>
            <p className="text-surface-400 text-sm mt-0.5">Select any date to see what was sold and how much was earned.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-4 py-2.5 border border-surface-200 rounded-2xl text-sm font-bold text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-surface-50 cursor-pointer"
            />
          </div>
        </div>

        {dateLoading ? (
          <div className="flex items-center justify-center h-40 text-surface-400 font-bold text-sm">Loading...</div>
        ) : dateReport && dateReport.products.length > 0 ? (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Gross Revenue</p>
                <p className="text-2xl font-black text-blue-700">{formatCurrency(dateReport.totalRevenue)}</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Cost of Goods</p>
                <p className="text-2xl font-black text-red-600">{formatCurrency(dateReport.totalRevenue - dateReport.totalProfit)}</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Net Profit</p>
                <p className="text-2xl font-black text-emerald-700">{formatCurrency(dateReport.totalProfit)}</p>
              </div>
              <div className="bg-purple-50 rounded-2xl p-4 text-center">
                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Items Sold</p>
                <p className="text-2xl font-black text-purple-700">{dateReport.totalItems}</p>
              </div>
            </div>

            {/* Product breakdown table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-black text-surface-400 uppercase tracking-widest border-b border-surface-100">
                    <th className="pb-3">#</th>
                    <th className="pb-3">Product</th>
                    <th className="pb-3 text-center">Qty</th>
                    <th className="pb-3 text-right">Revenue</th>
                    <th className="pb-3 text-right">Cost</th>
                    <th className="pb-3 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50">
                  {dateReport.products.map((p, i) => {
                    return (
                      <tr key={i} className="hover:bg-surface-50/60 transition-colors">
                        <td className="py-3 pr-4">
                          <span className="w-7 h-7 bg-surface-100 rounded-lg flex items-center justify-center text-xs font-black text-surface-600">{i + 1}</span>
                        </td>
                        <td className="py-3 font-bold text-surface-900 text-sm">{p.name}</td>
                        <td className="py-3 text-center">
                          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-black">{p.quantity}</span>
                        </td>
                        <td className="py-3 text-right text-sm font-bold text-surface-500">{formatCurrency(p.revenue)}</td>
                        <td className="py-3 text-right text-sm font-bold text-red-400">{formatCurrency(p.cost)}</td>
                        <td className="py-3 text-right font-black text-emerald-600">{formatCurrency(p.profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-surface-300">
            <ShoppingBag className="w-10 h-10" />
            <p className="font-bold text-sm">No completed orders on this date.</p>
          </div>
        )}
      </div>

      {/* ── Header for rest of analytics ──────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-2xl font-bold text-surface-900">Advanced Analytics</h2>
          <p className="text-surface-500 text-sm">Deep insights into your business performance.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.open(`${import.meta.env.VITE_API_URL}/reports/export/sales?token=${localStorage.getItem('pos_token')}`, '_blank')}
            className="px-6 py-2.5 bg-white border border-surface-200 hover:border-primary-500 hover:text-primary-600 text-surface-600 font-bold rounded-2xl transition-all shadow-sm flex items-center gap-2 text-sm group"
          >
            Export Sales (CSV)
          </button>
        </div>
      </div>

      {/* AI Business Insights Section */}
      {forecast && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-900 to-surface-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Sparkles className="w-48 h-48" />
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="space-y-4">
                <span className="px-4 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/10">AI Insights</span>
                <h3 className="font-heading text-3xl font-black leading-tight">Tomorrow's Prediction</h3>
                <p className="text-surface-300 text-sm leading-relaxed max-w-xs">Our AI analyzed your last 30 days of performance to project tomorrow's results.</p>
              </div>

              <div className="flex flex-col justify-center items-center lg:items-start space-y-2 p-6 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-sm">
                <p className="text-xs font-black text-indigo-300 uppercase tracking-widest">{forecast.tomorrow.day} Projection</p>
                <p className="text-5xl font-black font-heading text-white">{formatCurrency(forecast.tomorrow.predictedRevenue)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`w-2 h-2 rounded-full ${forecast.tomorrow.confidence === 'High' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">Confidence: {forecast.tomorrow.confidence}</span>
                </div>
              </div>

              <div className="flex flex-col justify-center space-y-6">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Growth Trend</p>
                    <p className={`text-3xl font-black ${parseFloat(forecast.growthTrend) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {parseFloat(forecast.growthTrend) >= 0 ? '↑' : '↓'} {Math.abs(forecast.growthTrend)}%
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-bold text-white">{parseFloat(forecast.growthTrend) >= 0 ? 'Business is Growing' : 'Sales slightly down'}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Historical Day-by-Day Averages</p>
                  <div className="flex items-end gap-1.5 h-12">
                    {forecast.dayOfWeekAverages.map((day, i) => {
                      const maxAvg = Math.max(...forecast.dayOfWeekAverages.map(d => d.average));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                          <div className="relative w-full flex flex-col justify-end h-full">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black opacity-0 group-hover/bar:opacity-100 transition-opacity bg-indigo-500 px-1 rounded">{formatCurrency(day.average)}</div>
                            <div
                              className={`w-full rounded-t-sm transition-all duration-700 ${new Date().getDay() + 1 === i ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-indigo-500/40 group-hover/bar:bg-indigo-400'}`}
                              style={{ height: `${(day.average / (maxAvg || 1)) * 100}%`, minHeight: '2px' }}
                            ></div>
                          </div>
                          <span className="text-[8px] font-bold text-indigo-400 uppercase">{day.name.substring(0, 1)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* New Inventory Lost Opportunity Alerts */}
          {forecast.inventoryWarnings && forecast.inventoryWarnings.length > 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
                <h4 className="font-heading font-black text-rose-900 text-lg uppercase tracking-tight">Stockout Warning: Lost Opportunity Alert</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {forecast.inventoryWarnings.map((warn, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
                    <p className="font-bold text-surface-900">{warn.productName}</p>
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-surface-500 uppercase font-black tracking-widest text-[9px]">Stock</span>
                      <span className="font-black text-rose-600">{warn.currentStock} units</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-500 uppercase font-black tracking-widest text-[9px]">Needed</span>
                      <span className="font-black text-surface-900">{warn.predictedNeeded} units</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-rose-50 flex items-center justify-between">
                      <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Revenue at Risk</span>
                      <span className="font-black text-rose-600">{formatCurrency(warn.lostRevenuePotential)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profit & Loss Analysis */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-200 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-heading font-bold text-surface-900 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-surface-900" /> Profit & Loss Analysis (Last 7 Days)
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-surface-400 bg-surface-50 px-3 py-1 rounded-full border border-surface-100">Live Financials</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-black text-surface-400 uppercase tracking-widest border-b border-surface-100">
                  <th className="pb-4">Date</th>
                  <th className="pb-4 text-right">Revenue</th>
                  <th className="pb-4 text-right">Expenses</th>
                  <th className="pb-4 text-right">Net Profit</th>
                  <th className="pb-4 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {dailyData.map((day, i) => {
                  const margin = day.sales > 0 ? ((day.profit / day.sales) * 100).toFixed(1) : '0';
                  return (
                    <tr key={i} className="hover:bg-surface-50/50 transition-colors group">
                      <td className="py-4 font-bold text-surface-600 text-sm">{day.date}</td>
                      <td className="py-4 text-right font-bold text-surface-900">{formatCurrency(day.sales)}</td>
                      <td className="py-4 text-right font-bold text-red-500">-{formatCurrency(day.expenses)}</td>
                      <td className={`py-4 text-right font-black ${day.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {day.profit < 0 ? '-' : ''}{formatCurrency(Math.abs(day.profit))}
                      </td>
                      <td className="py-4 text-right">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${day.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {margin}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Sales Chart Placeholder */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-200">
          <h3 className="font-heading font-bold text-surface-900 mb-6 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-surface-900" /> Sales Distribution
          </h3>
          <div className="space-y-4">
            {dailyData.map((day, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="text-xs font-bold text-surface-400 w-24">{day.date}</div>
                <div className="flex-1 h-3 bg-surface-50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-1000"
                    style={{ width: `${Math.min(100, (day.sales / (Math.max(...dailyData.map(d => d.sales)) || 1)) * 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs font-black text-surface-900 w-20 text-right">{formatCurrency(day.sales)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bestsellers */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-200">
          <h3 className="font-heading font-bold text-surface-900 mb-6 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-surface-900" /> Top Selling Products
          </h3>
          <div className="space-y-4">
            {bestsellers.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface-50">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-primary-600 shadow-sm">{i + 1}</div>
                  <div>
                    <p className="font-bold text-surface-900">{item.name}</p>
                    <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{item.quantity} units sold</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-600">{formatCurrency(item.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kitchen Efficiency */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-200 lg:col-span-2">
          <h3 className="font-heading font-bold text-surface-900 mb-6 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-surface-900" /> Kitchen Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-indigo-50 rounded-3xl text-center">
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Avg Prep Time</p>
              <p className="text-4xl font-black text-indigo-900">{kitchenData?.averagePrepTime || 0} <span className="text-sm">min</span></p>
            </div>
            <div className="md:col-span-2 space-y-3">
              <p className="text-sm font-bold text-surface-600">Recent Kitchen Times</p>
              <div className="flex flex-wrap gap-2">
                {kitchenData?.orders?.slice(0, 10).map((o, i) => (
                  <div key={i} className="px-3 py-2 bg-white border border-surface-200 rounded-xl flex items-center gap-2">
                    <span className="text-[10px] font-bold text-surface-400">#{o.orderNumber}</span>
                    <span className="font-bold text-surface-900">{o.prepTimeMinutes}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
