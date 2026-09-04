import { useEffect, useState } from 'react';
import { Check, Clock3, Mail, MapPin, Phone, X } from 'lucide-react';
import { getAdminBookings, updateAdminBookingStatus } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function PackageBookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const loadBookings = async () => {
    try {
      const response = await getAdminBookings();
      setBookings(response.data.data || []);
    } catch (error) {
      console.error('Failed to load package bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (booking, status) => {
    setProcessingId(booking.id);
    try {
      await updateAdminBookingStatus(booking.id, { status });
      await loadBookings();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update booking.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading booking requests...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="font-heading text-2xl sm:text-3xl font-black text-surface-900">Package Bookings</h2>
        <p className="mt-1 font-medium text-surface-500">Review customer event requests before confirming them.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-200 bg-white px-6 py-16 text-center">
          <Clock3 className="mx-auto mb-3 h-10 w-10 text-surface-300" />
          <p className="font-bold text-surface-500">No package booking requests yet.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {bookings.map(booking => (
            <article key={booking.id} className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-surface-400">{booking.package.name}</p>
                  <h3 className="mt-1 text-xl font-black text-surface-900">{booking.customerName}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${booking.status === 'pending' ? 'bg-amber-100 text-amber-700' : booking.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {booking.status}
                </span>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-surface-600 sm:grid-cols-2">
                <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary-500" />{formatDate(booking.eventDate)}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary-500" />{booking.venue}</p>
                <p><strong className="text-surface-900">What:</strong> {booking.eventType}</p>
                {booking.guestCount && <p><strong className="text-surface-900">Guests:</strong> {booking.guestCount}</p>}
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary-500" />{booking.customerEmail}</p>
                {booking.customerPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary-500" />{booking.customerPhone}</p>}
              </div>
              {booking.notes && <p className="mt-4 rounded-xl bg-surface-50 p-3 text-sm text-surface-600"><strong className="text-surface-900">Notes:</strong> {booking.notes}</p>}

              {booking.status === 'pending' && (
                <div className="mt-5 flex gap-3 border-t border-surface-100 pt-4">
                  <button disabled={processingId === booking.id} onClick={() => updateStatus(booking, 'accepted')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" /> Accept Booking</button>
                  <button disabled={processingId === booking.id} onClick={() => updateStatus(booking, 'rejected')} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
