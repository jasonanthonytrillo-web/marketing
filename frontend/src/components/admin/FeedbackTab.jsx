import { useState, useEffect } from 'react';
import { getFeedbackStats } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { useSocket } from '../../context/SocketContext';

export default function FeedbackTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { onEvent } = useSocket();

  useEffect(() => {
    loadStats();
  }, []);

  // Real-time listener
  useEffect(() => {
    if (!onEvent) return;
    const unsub = onEvent('new_feedback', () => {
      loadStats(); // Auto refresh when new feedback arrives
    });
    return unsub;
  }, [onEvent]);

  const loadStats = async () => {
    try {
      const res = await getFeedbackStats();
      setData(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-surface-500 font-bold text-xs uppercase tracking-widest">Loading Feedback...</p>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-heading text-3xl font-black text-surface-900 tracking-tight">Customer Feedback</h2>
          <p className="text-surface-500 font-medium">Hear what your customers are saying about your shop.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-surface-200 text-center flex flex-col items-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-400 mb-2">Average Rating</p>
          <p className="text-6xl font-black text-surface-900 mb-2">{Number(data?.averageRating || 0).toFixed(1)}</p>
          <div className="flex gap-1 text-2xl">
            {[1, 2, 3, 4, 5].map(s => (
              <span key={s} className={s <= Math.round(data?.averageRating || 0) ? 'text-amber-400' : 'text-surface-200'}>⭐</span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-surface-200 text-center flex flex-col items-center justify-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-surface-400 mb-2">Total Reviews</p>
          <p className="text-5xl font-black text-surface-900">{data?.totalReviews || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-indigo-600 rounded-[2rem] p-8 shadow-xl text-white flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3">💬</div>
          <h4 className="font-black text-lg mb-1 uppercase tracking-tight">Customer Voice</h4>
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Real-time Satisfaction</p>
        </div>
      </div>

      {/* Recent Reviews List */}
      <div className="bg-white rounded-[2rem] border border-surface-200 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-surface-100 flex justify-between items-center">
          <h3 className="font-heading font-bold text-surface-900">Recent Customer Reviews</h3>
        </div>
        
        <div className="divide-y divide-surface-50">
          {data?.recent && data.recent.length > 0 ? (
            data.recent.map((review, i) => (
              <div key={i} className="px-8 py-6 hover:bg-surface-50 transition-colors group">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                      {review.feedbackRating >= 4 ? '😍' : review.feedbackRating >= 3 ? '😊' : '😞'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-surface-900">{review.customerName}</h4>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-surface-200 rounded-full text-surface-600 uppercase tracking-tighter">
                          Order #{review.orderNumber.split('-')[1] || review.orderNumber}
                        </span>
                      </div>
                      <div className="flex gap-0.5 mb-3">
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} className={`text-sm ${s <= review.feedbackRating ? 'text-amber-400' : 'text-surface-200'}`}>★</span>
                        ))}
                      </div>
                      <p className="text-surface-600 text-sm leading-relaxed max-w-2xl italic">
                        "{review.feedbackComment || 'No comment left.'}"
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-surface-400 uppercase tracking-widest">{formatDate(review.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center">
              <div className="text-6xl mb-4 opacity-20">📭</div>
              <p className="text-surface-400 font-bold uppercase tracking-widest text-xs">No reviews yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
