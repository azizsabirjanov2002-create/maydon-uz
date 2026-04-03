'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CalendarDays, MapPin, User, Phone, Ban, UserX, 
  CheckCircle2, Clock, Filter, AlertCircle, ChevronDown, Flag, Search, ShieldAlert
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBookings();
  }, [filterDate, filterStatus]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      let qs = '';
      if (filterStatus !== 'ALL') qs += `&status=${filterStatus}`;
      if (filterDate) qs += `&date=${filterDate}`;

      const res = await api.get(`/admin/bookings?limit=300${qs}`);
      setBookings(res.data.bookings || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const openCancelModal = (bookingId: string) => {
     setCancelBookingId(bookingId);
     setCancelReason('');
     setCancelModalOpen(true);
  };

  const handleForceCancel = async () => {
    if (!cancelBookingId) return;
    if (!cancelReason.trim()) {
      toast.warning('Причина отмены обязательна для аудита.');
      return;
    }

    setCancelLoading(true);

    try {
      await api.put(`/admin/bookings/${cancelBookingId}/cancel`, { reason: cancelReason.trim() });
      toast.success('Бронь успешно отменена!');
      setCancelModalOpen(false);
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при отмене брони');
      setCancelModalOpen(false);
    } finally {
      setCancelLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return { label: 'Подтверждено', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 };
      case 'COMPLETED': return { label: 'Завершено', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Flag };
      case 'CANCELLED': return { label: 'Отменено', color: 'bg-red-100 text-red-800 border-red-200', icon: Ban };
      case 'NO_SHOW': return { label: 'Неявка', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: UserX };
      case 'PENDING': return { label: 'Ожидает', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock };
      default: return { label: status, color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Clock };
    }
  };

  // Local filter for phone/name/venue
  const filteredBookings = bookings.filter(b => {
    if (!searchQuery) return true;
    const sq = searchQuery.toLowerCase();
    const phoneMatches = b.user?.phone?.toLowerCase().includes(sq);
    const nameMatches = b.user?.fullName?.toLowerCase().includes(sq);
    const venueMatches = b.field?.venue?.name?.toLowerCase().includes(sq);
    return phoneMatches || nameMatches || venueMatches;
  });

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 z-10 sticky top-0 shadow-sm">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Мониторинг бронирований</h1>
               <p className="text-sm text-slate-500 mt-1">Глобальный аудит активности всех пользователей и площадок.</p>
            </div>
         </div>

         {/* Filters Row */}
         <div className="max-w-6xl mx-auto mt-6 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Поиск по телефону клиента, имени или названию площадки..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              />
            </div>
            
            <div className="flex w-full sm:w-auto gap-2">
               <input 
                  type="date" 
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0" 
               />
               <select 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
               >
                  <option value="ALL">Все статусы</option>
                  <option value="CONFIRMED">Актуальные</option>
                  <option value="COMPLETED">Завершенные</option>
                  <option value="NO_SHOW">Неявки</option>
                  <option value="CANCELLED">Отмененные</option>
               </select>
            </div>
         </div>
      </div>

      {/* Bookings List */}
      <div className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
         {loading ? (
           <div className="text-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
           </div>
         ) : filteredBookings.length === 0 ? (
           <div className="bg-white rounded-[1.5rem] border border-slate-200 border-dashed p-12 text-center text-slate-500 shadow-sm font-medium">
               <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
               <p className="text-lg text-slate-900 font-bold mb-1">Пусто</p>
               <p>По заданным фильтрам бронирований не найдено на платформе.</p>
           </div>
         ) : (
           <div className="space-y-3">
             {filteredBookings.map(b => {
                const statusConf = getStatusConfig(b.status);
                const StatusIcon = statusConf.icon;
                const bookingDateStr = new Date(b.date).toLocaleDateString('ru-RU');
                const endTime = new Date(new Date(`1970-01-01T${b.startTime}`).getTime() + b.durationMinutes * 60000).toTimeString().substring(0, 5);

                const isCancellable = b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && b.status !== 'NO_SHOW';

                return (
                  <div key={b.id} className={`bg-white rounded-2xl border ${isCancellable ? 'border-slate-200' : 'border-slate-100 opacity-70'} flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow`}>
                     
                     {/* Timestamp Block */}
                     <div className={`w-full md:w-36 flex flex-row md:flex-col items-center md:items-start justify-between border-b md:border-b-0 md:border-r border-slate-100 p-4 shrink-0 bg-slate-50/50 rounded-tl-2xl rounded-tr-2xl md:rounded-tr-none md:rounded-bl-2xl`}>
                        <div className="flex bg-white px-2 py-1 rounded shadow-sm border border-slate-100 font-extrabold text-slate-900 md:mb-2">
                          {b.startTime.substring(0,5)} - {endTime}
                        </div>
                        <div className="font-bold text-xs text-slate-500">{bookingDateStr}</div>
                     </div>

                     {/* Details Block */}
                     <div className="flex-1 p-4 md:p-5 flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-4 flex-1">
                           
                           {/* User Info */}
                           <div className="flex items-center gap-4">
                             <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                               <User className="w-4 h-4"/>
                             </div>
                             <div>
                                <p className="font-bold text-slate-900 text-sm leading-tight">{b.user?.fullName || 'Гость'}</p>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">{b.user?.phone}</p>
                             </div>
                           </div>
                           
                           {/* Venue Info */}
                           <div className="flex items-center gap-4">
                             <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                               <MapPin className="w-4 h-4"/>
                             </div>
                             <div>
                                <p className="font-bold text-slate-900 text-sm leading-tight">{b.field?.venue?.name}</p>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">{b.field?.name} • <span className="font-bold text-indigo-600">{Number(b.totalAmount).toLocaleString('ru-RU')} sum</span></p>
                             </div>
                           </div>

                        </div>

                        {/* Status & Actions */}
                        <div className="flex flex-row md:flex-col justify-between items-end md:items-end w-full md:w-48 shrink-0 border-t md:border-t-0 p-4 md:p-0 border-slate-100">
                           <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border mb-0 md:mb-auto ${statusConf.color}`}>
                             <StatusIcon className="w-4 h-4" /> {statusConf.label}
                           </div>
                           
                           {isCancellable && (
                             <button 
                               onClick={() => openCancelModal(b.id)}
                               className="bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                             >
                                <ShieldAlert className="w-3.5 h-3.5"/> Принудительная отмена
                             </button>
                           )}
                           {b.notes && b.status === 'CANCELLED' && (
                             <div className="text-[10px] text-red-500 font-bold italic mt-2 text-right">
                               Причина отмены: <br/>"{b.notes}"
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
                );
             })}
           </div>
         )}
      </div>
      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            <div className="p-6">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                     <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">Принудительная отмена</h3>
                    <p className="text-sm text-slate-500">Действие от лица администратора</p>
                  </div>
               </div>
               
               <div className="mb-5">
                 <p className="text-sm text-slate-700 font-medium mb-3">
                   ВНИМАНИЕ! Вы отменяете бронь. Клиент и владелец площадки увидят эту отмену. 
                 </p>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                   Причина отмены (обязательно)
                 </label>
                 <textarea 
                    rows={3}
                    placeholder="Например: По просьбе владельца, технические работы..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:ring-red-500 rounded-xl outline-none focus:ring-2 text-sm resize-none font-medium text-slate-700 transition-shadow"
                 />
               </div>

               <div className="flex gap-3">
                  <button 
                    onClick={() => setCancelModalOpen(false)}
                    disabled={cancelLoading}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Назад
                  </button>
                  <button 
                    onClick={handleForceCancel}
                    disabled={cancelLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-red-600/20"
                  >
                    {cancelLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Отменить бронь'
                    )}
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
