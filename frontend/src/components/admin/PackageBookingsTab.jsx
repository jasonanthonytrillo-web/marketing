import { useEffect, useState } from 'react';
import { Check, Clock3, ExternalLink, Mail, MapPin, Phone, X } from 'lucide-react';
import { getAdminBookings, updateAdminBookingStatus, requestAdminBookingPayment, updateAdminBookingPaymentStatus } from '../../services/api';
import { formatDate } from '../../utils/helpers';

const bookingPaymentMethodLabel = (method) => ({ cash: 'Cash', gcash: 'GCash', maya: 'Maya' }[method] || 'GCash');

export default function PackageBookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ paymentMode: 'downpayment', paymentAmount: '' });

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

  const openPaymentRequest = (booking) => {
    setPaymentBooking(booking);
    const packageAmount = Number(String(booking.package?.priceText || '').replace(/[^0-9.]/g, ''));
    setPaymentForm({ paymentMode: booking.paymentMode || 'full_payment', paymentAmount: booking.paymentAmount || (Number.isFinite(packageAmount) ? packageAmount : '') });
  };

  const sendPaymentRequest = async (event) => {
    event.preventDefault();
    setProcessingId(paymentBooking.id);
    try {
      await requestAdminBookingPayment(paymentBooking.id, paymentForm);
      setPaymentBooking(null);
      await loadBookings();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send payment instructions.');
    } finally {
      setProcessingId(null);
    }
  };

  const updatePaymentStatus = async (booking, paymentStatus) => {
    setProcessingId(booking.id);
    try {
      await updateAdminBookingPaymentStatus(booking.id, { paymentStatus });
      await loadBookings();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update payment status.');
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

      {paymentBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={sendPaymentRequest} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-surface-400">Payment request</p><h3 className="mt-1 text-xl font-black text-surface-900">{paymentBooking.customerName}</h3></div>
              <button type="button" onClick={() => setPaymentBooking(null)} className="text-2xl text-surface-400">×</button>
            </div>
            <label className="mt-5 block text-sm font-bold text-surface-700">Payment type
              <select value={paymentForm.paymentMode} onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })} className="input-field mt-1 w-full"><option value="downpayment">Downpayment</option><option value="full_payment">Full payment</option></select>
            </label>
            <label className="mt-4 block text-sm font-bold text-surface-700">Amount to pay
              <input required type="number" min="0.01" step="0.01" value={paymentForm.paymentAmount} onChange={e => setPaymentForm({ ...paymentForm, paymentAmount: e.target.value })} className="input-field mt-1 w-full" />
            </label>
            <div className="mt-4 rounded-2xl bg-surface-50 p-4 text-sm"><span className="font-bold text-surface-700">Payment method</span><p className="mt-1 font-black uppercase tracking-wider text-primary-600">{bookingPaymentMethodLabel(paymentBooking.paymentMethod)}</p><p className="mt-1 text-xs text-surface-500">The QR code configured for this method will be sent automatically.</p></div>
            <div className="mt-4 rounded-2xl border border-surface-200 bg-surface-50 p-4 text-sm"><p className="font-bold text-surface-700">Customer instruction</p><p className="mt-1 leading-relaxed text-surface-600">Scan the {paymentBooking.paymentMethod === 'maya' ? 'Maya' : 'GCash'} QR code, pay the requested amount, then submit the last 4 digits of your {paymentBooking.paymentMethod === 'maya' ? 'Maya' : 'GCash'} reference ID.</p></div>
            <button disabled={processingId === paymentBooking.id} className="mt-5 w-full rounded-xl bg-primary-600 py-3 font-black text-white disabled:opacity-50">{processingId === paymentBooking.id ? 'Sending...' : 'Send Payment Instructions'}</button>
          </form>
        </div>
      )}

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
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-primary-500" />
                  <span className="min-w-0 break-words">{booking.venue}</span>
                </div>
                <p><strong className="text-surface-900">What:</strong> {booking.eventType}</p>
                <p><strong className="text-surface-900">Payment:</strong> {bookingPaymentMethodLabel(booking.paymentMethod)}</p>
                {booking.trademark && <p className="sm:col-span-2"><strong className="text-surface-900">Trademark:</strong> {booking.trademark}</p>}
                {booking.guestCount && <p><strong className="text-surface-900">Guests:</strong> {booking.guestCount}</p>}
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary-500" />{booking.customerEmail}</p>
                {booking.customerPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary-500" />{booking.customerPhone}</p>}
              </div>
              {booking.venueLat !== null && booking.venueLat !== undefined && booking.venueLng !== null && booking.venueLng !== undefined && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${booking.venueLat},${booking.venueLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <ExternalLink className="h-4 w-4" /> Navigate in Google Maps
                </a>
              )}
              {booking.notes && <p className="mt-4 rounded-xl bg-surface-50 p-3 text-sm text-surface-600"><strong className="text-surface-900">Notes:</strong> {booking.notes}</p>}

              {booking.status === 'pending' && (
                <div className="mt-5 flex gap-3 border-t border-surface-100 pt-4">
                  {booking.paymentStatus === 'submitted' ? (
                    <>
                      <button disabled={processingId === booking.id} onClick={() => updatePaymentStatus(booking, 'verified')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"><Check className="h-4 w-4" /> Verify ₱{Number(booking.paymentAmount).toFixed(2)} / Ref {booking.paymentReference}</button>
                      <button disabled={processingId === booking.id} onClick={() => updatePaymentStatus(booking, 'rejected')} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">Reject Payment</button>
                    </>
                  ) : booking.paymentStatus === 'verified' ? (
                    <button disabled={processingId === booking.id} onClick={() => updateStatus(booking, 'accepted')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" /> Accept Booking</button>
                  ) : booking.paymentMethod === 'cash' ? (
                    <button disabled={processingId === booking.id} onClick={() => updateStatus(booking, 'accepted')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" /> Accept Cash Booking</button>
                  ) : (
                    <button disabled={processingId === booking.id} onClick={() => openPaymentRequest(booking)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-amber-600 disabled:opacity-50">Send Payment Request</button>
                  )}
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
