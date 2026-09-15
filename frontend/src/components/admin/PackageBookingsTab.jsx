import { useCallback, useEffect, useState } from 'react';
import { Archive, Check, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Mail, MapPin, Phone, Trash2, X } from 'lucide-react';
import { deleteAdminBooking, getAdminBookings, updateAdminBookingStatus, requestAdminBookingPayment, updateAdminBookingPaymentStatus, exportBookingsExcel } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { useSocket } from '../../context/SocketContext';
import { downloadBlob } from '../../utils/csvExport';

const bookingPaymentMethodLabel = (method) => ({ cash: 'Cash', gcash: 'GCash', maya: 'Maya' }[method] || 'GCash');

const getPaymentBadge = (booking) => {
  if (booking.paymentStatus === 'paid') return { label: 'Fully Paid', className: 'bg-emerald-100 text-emerald-700' };
  if (booking.paymentMode === 'downpayment') return { label: 'Downpayment', className: 'bg-amber-100 text-amber-700' };
  if (booking.paymentStatus === 'submitted') return { label: 'Payment Submitted', className: 'bg-blue-100 text-blue-700' };
  if (booking.paymentStatus === 'awaiting_payment') return { label: 'Awaiting Payment', className: 'bg-amber-100 text-amber-700' };
  if (booking.paymentStatus === 'verified' || (booking.status === 'accepted' && booking.paymentMethod === 'cash')) return { label: 'Fully Paid', className: 'bg-emerald-100 text-emerald-700' };
  return { label: 'Payment Pending', className: 'bg-slate-100 text-slate-600' };
};

export default function PackageBookingsTab() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [paymentCompletionBooking, setPaymentCompletionBooking] = useState(null);
  const [rejectionBooking, setRejectionBooking] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentForm, setPaymentForm] = useState({ paymentMode: 'downpayment', paymentAmount: '' });
  const [view, setView] = useState('active');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const { onEvent } = useSocket();

  const loadBookings = useCallback(async () => {
    try {
      const response = await getAdminBookings(view === 'archives', page, 10);
      setBookings(response.data.data || []);
      setPagination(response.data.meta || { page, total: 0, totalPages: 1 });
    } catch (error) {
      console.error('Failed to load package bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [view, page]);

  useEffect(() => {
    setLoading(true);
    loadBookings();
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  useEffect(() => {
    const unsubscribe = onEvent('admin_notification_update', loadBookings);
    return unsubscribe;
  }, [onEvent, loadBookings]);

  const permanentlyDeleteBooking = async (booking) => {
    if (!window.confirm(`Permanently delete ${booking.customerName}'s archived booking? This cannot be undone.`)) return;
    setProcessingId(booking.id);
    try {
      await deleteAdminBooking(booking.id);
      await loadBookings();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete archived booking.');
    } finally {
      setProcessingId(null);
    }
  };

  const updateStatus = async (booking, status, adminNotes = '') => {
    setProcessingId(booking.id);
    try {
      await updateAdminBookingStatus(booking.id, { status, adminNotes });
      await loadBookings();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update booking.');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectionModal = (booking) => {
    setRejectionBooking(booking);
    setRejectionReason('');
  };

  const submitRejection = async (event) => {
    event.preventDefault();
    if (!rejectionReason.trim()) return;
    await updateStatus(rejectionBooking, 'rejected', rejectionReason.trim());
    setRejectionBooking(null);
  };

  const openPaymentRequest = (booking) => {
    setPaymentBooking(booking);
    const packageAmount = Number(String(booking.package?.priceText || '').replace(/[^0-9.]/g, ''));
    const paymentMode = booking.paymentMode || 'full_payment';
    setPaymentForm({ paymentMode, paymentAmount: paymentMode === 'downpayment' ? 1000 : (Number.isFinite(packageAmount) ? packageAmount : '') });
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

  const completeDownpayment = async (booking) => {
    const packageAmount = Number(String(booking.package?.priceText || '').replace(/[^0-9.]/g, ''));
    const remainingAmount = Number.isFinite(packageAmount) ? packageAmount - Number(booking.paymentAmount || 0) : 0;
    if (!window.confirm(`Mark the remaining ₱${remainingAmount.toFixed(2)} as paid and complete this booking payment?`)) return;
    await updatePaymentStatus(booking, 'paid');
  };

  const exportAcceptedBookings = async () => {
    try {
      const response = await exportBookingsExcel();
      downloadBlob(`Accepted_Bookings_${new Date().toISOString().slice(0, 10)}.xlsx`, response);
    } catch (error) {
      console.error(error);
      alert('Failed to export accepted bookings. Please try again.');
    }
  };

  if (loading) return <div className="p-8 text-center text-surface-500">Loading booking requests...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-black text-surface-900">Package Bookings</h2>
            <p className="mt-1 font-medium text-surface-500">Review customer event requests before confirming them.</p>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2">
            <button type="button" onClick={exportAcceptedBookings} disabled={view !== 'active'} title={view !== 'active' ? 'Switch to Active requests to export accepted bookings' : 'Export accepted bookings'} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"><Download className="h-4 w-4" /> Export Excel</button>
            <div className="flex rounded-2xl border border-surface-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => { setPage(1); setView('active'); }} className={`rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${view === 'active' ? 'bg-primary-600 text-white' : 'text-surface-500 hover:bg-surface-50'}`}>Active requests</button>
            <button type="button" onClick={() => { setPage(1); setView('archives'); }} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${view === 'archives' ? 'bg-surface-900 text-white' : 'text-surface-500 hover:bg-surface-50'}`}><Archive className="h-4 w-4" /> Archives</button>
            </div>
          </div>
        </div>
      </div>

      {paymentBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={sendPaymentRequest} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-surface-400">Payment request</p><h3 className="mt-1 text-xl font-black text-surface-900">{paymentBooking.customerName}</h3></div>
              <button type="button" onClick={() => setPaymentBooking(null)} className="text-2xl text-surface-400">×</button>
            </div>
            <div className="mt-5 rounded-2xl border border-surface-200 bg-surface-50 p-4 text-sm"><p className="font-bold text-surface-700">Customer payment choice</p><p className="mt-1 font-black text-primary-600">{paymentForm.paymentMode === 'downpayment' ? 'Downpayment (₱1,000)' : 'Full payment'}</p></div>
            <label className="mt-4 block text-sm font-bold text-surface-700">Amount to pay
              <input required readOnly type="number" min="0.01" step="0.01" value={paymentForm.paymentAmount} onChange={e => setPaymentForm({ ...paymentForm, paymentAmount: e.target.value })} className="input-field mt-1 w-full bg-surface-50 font-black" />
            </label>
            <div className="mt-4 rounded-2xl bg-surface-50 p-4 text-sm"><span className="font-bold text-surface-700">Payment method</span><p className="mt-1 font-black uppercase tracking-wider text-primary-600">{bookingPaymentMethodLabel(paymentBooking.paymentMethod)}</p><p className="mt-1 text-xs text-surface-500">The QR code configured for this method will be sent automatically.</p></div>
            <div className="mt-4 rounded-2xl border border-surface-200 bg-surface-50 p-4 text-sm"><p className="font-bold text-surface-700">Customer instruction</p><p className="mt-1 leading-relaxed text-surface-600">Scan the {paymentBooking.paymentMethod === 'maya' ? 'Maya' : 'GCash'} QR code, pay the requested amount, then submit the last 4 digits of your {paymentBooking.paymentMethod === 'maya' ? 'Maya' : 'GCash'} reference ID.</p></div>
            <button disabled={processingId === paymentBooking.id} className="mt-5 w-full rounded-xl bg-primary-600 py-3 font-black text-white disabled:opacity-50">{processingId === paymentBooking.id ? 'Sending...' : 'Send Payment Instructions'}</button>
          </form>
        </div>
      )}

      {bookings.length > 0 && pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold text-surface-500">Showing page {pagination.page} of {pagination.totalPages} · {pagination.total} bookings</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-surface-200 px-3 py-2 text-xs font-black text-surface-600 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button>
            <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(current => current + 1)} className="inline-flex items-center gap-1 rounded-xl border border-surface-200 px-3 py-2 text-xs font-black text-surface-600 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {rejectionBooking && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={submitRejection} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-red-500">Reject booking</p><h3 className="mt-1 text-xl font-black text-surface-900">Why is this booking being rejected?</h3></div><button type="button" onClick={() => setRejectionBooking(null)} className="text-2xl text-surface-400">×</button></div>
            <p className="mt-2 text-sm text-surface-500">This reason will be sent to {rejectionBooking.customerName}.</p>
            <textarea required autoFocus rows="4" value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} placeholder="Example: The requested date is unavailable." className="input-field mt-4 w-full resize-none" />
            <div className="mt-5 flex gap-3"><button type="button" onClick={() => setRejectionBooking(null)} className="flex-1 rounded-xl border border-surface-200 py-3 text-sm font-black text-surface-600 hover:bg-surface-50">Cancel</button><button type="submit" disabled={processingId === rejectionBooking.id || !rejectionReason.trim()} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">{processingId === rejectionBooking.id ? 'Rejecting...' : 'Reject Booking'}</button></div>
          </form>
        </div>
      )}

      {paymentCompletionBooking && (() => {
        const packageAmount = Number(String(paymentCompletionBooking.package?.priceText || '').replace(/[^0-9.]/g, ''));
        const remainingAmount = Number.isFinite(packageAmount) ? packageAmount - Number(paymentCompletionBooking.paymentAmount || 0) : 0;
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-surface-200 bg-white p-6 shadow-2xl animate-scale-in">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></div>
                <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Complete payment</p><h3 className="mt-1 text-xl font-black text-surface-900">Mark booking as fully paid?</h3><p className="mt-2 text-sm leading-relaxed text-surface-500">Confirm that <span className="font-bold text-surface-800">{paymentCompletionBooking.customerName}</span> paid the remaining <span className="font-black text-emerald-700">₱{remainingAmount.toFixed(2)}</span>.</p></div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setPaymentCompletionBooking(null)} className="flex-1 rounded-xl border border-surface-200 py-3 text-sm font-black text-surface-600 hover:bg-surface-50">Cancel</button>
                <button type="button" onClick={async () => { await updatePaymentStatus(paymentCompletionBooking, 'paid'); setPaymentCompletionBooking(null); }} disabled={processingId === paymentCompletionBooking.id} className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{processingId === paymentCompletionBooking.id ? 'Saving...' : 'Confirm Paid'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {bookings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-200 bg-white px-6 py-16 text-center">
          <Clock3 className="mx-auto mb-3 h-10 w-10 text-surface-300" />
          <p className="font-bold text-surface-500">{view === 'archives' ? 'No rejected or cancelled bookings in the archives.' : 'No active package booking requests yet.'}</p>
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
                <div className="flex flex-wrap justify-end gap-2">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${booking.status === 'pending' ? 'bg-amber-100 text-amber-700' : booking.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {booking.status}
                  </span>
                  {(() => {
                    const paymentBadge = getPaymentBadge(booking);
                    return <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${paymentBadge.className}`}>{paymentBadge.label}</span>;
                  })()}
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-surface-600 sm:grid-cols-2">
                <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary-500" />{formatDate(booking.eventDate)}</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-primary-500" />
                  <span className="min-w-0 break-words">{booking.venue}</span>
                </div>
                <p><strong className="text-surface-900">What:</strong> {booking.eventType}</p>
                <p><strong className="text-surface-900">Payment:</strong> {bookingPaymentMethodLabel(booking.paymentMethod)}</p>
                {booking.locationGuide && <p className="sm:col-span-2"><strong className="text-surface-900">Location guide:</strong> {booking.locationGuide}</p>}
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

              {view === 'archives' ? (
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-surface-100 pt-4">
                  <p className="text-xs font-medium text-surface-500">This booking is archived and no longer active.</p>
                  <button disabled={processingId === booking.id} onClick={() => permanentlyDeleteBooking(booking)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete permanently</button>
                </div>
              ) : booking.status === 'accepted' && booking.paymentMode === 'downpayment' && booking.paymentStatus === 'verified' ? (
                <div className="mt-5 flex gap-3 border-t border-surface-100 pt-4">
                  <button disabled={processingId === booking.id} onClick={() => setPaymentCompletionBooking(booking)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" /> Payment Completed</button>
                </div>
              ) : booking.status === 'pending' && (
                <div className="mt-5 flex gap-3 border-t border-surface-100 pt-4">
                  {booking.paymentStatus === 'submitted' ? (
                    <>
                      <button disabled={processingId === booking.id} onClick={() => updatePaymentStatus(booking, 'verified')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"><Check className="h-4 w-4" /> Verify ₱{Number(booking.paymentAmount).toFixed(2)} / Ref {booking.paymentReference}</button>
                      <button disabled={processingId === booking.id} onClick={() => updatePaymentStatus(booking, 'rejected')} className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 px-4 py-3 text-sm font-black text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50">Request Payment Again</button>
                    </>
                  ) : booking.paymentStatus === 'verified' ? (
                    <button disabled={processingId === booking.id} onClick={() => updateStatus(booking, 'accepted')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" /> Accept Booking</button>
                  ) : booking.paymentMethod === 'cash' ? (
                    <button disabled={processingId === booking.id} onClick={() => updateStatus(booking, 'accepted')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"><Check className="h-4 w-4" /> Accept Cash Booking</button>
                  ) : (
                    <button disabled={processingId === booking.id} onClick={() => openPaymentRequest(booking)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-amber-600 disabled:opacity-50">Send Payment Request</button>
                  )}
                  <button disabled={processingId === booking.id} onClick={() => openRejectionModal(booking)} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"><X className="h-4 w-4" /> Reject Booking</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
