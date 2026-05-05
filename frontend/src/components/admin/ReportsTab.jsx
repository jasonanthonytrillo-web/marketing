import { useState, useEffect } from 'react';
import { getDailyReport, getBestsellers, getKitchenTimes } from '../../services/api';
import { formatCurrency } from '../../utils/helpers';

export default function ReportsTab() {
  const [dailyData, setDailyData] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [kitchenData, setKitchenData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dailyRes, bestRes, kitchenRes] = await Promise.all([
        getDailyReport(7),
        getBestsellers(),
        getKitchenTimes()
      ]);
      setDailyData(dailyRes.data.data);
      setBestsellers(bestRes.data.data);
      setKitchenData(kitchenRes.data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Generating analytics...</div>;

  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-2xl font-bold text-surface-900">Advanced Analytics</h2>
          <p className="text-surface-500 text-sm">Deep insights into your business performance.</p>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Sales Chart Placeholder */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-surface-200">
          <h3 className="font-heading font-bold text-surface-900 mb-6 flex items-center gap-2">
            📅 Last 7 Days Sales
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
            🏆 Top Selling Products
          </h3>
          <div className="space-y-4">
            {bestsellers.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface-50">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-primary-600 shadow-sm">{i+1}</div>
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
            👨‍🍳 Kitchen Performance
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
