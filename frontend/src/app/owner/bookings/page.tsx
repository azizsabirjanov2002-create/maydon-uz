'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CalendarDays, MapPin, User, Phone, Ban, UserX, 
  CheckCircle2, Clock, Filter, AlertCircle, ChevronDown, Flag
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type Booking = {
  id: string;
  fieldId: number;
  userId: number;
  date: string;
  startTime: string;
  durationMinutes: number;
  totalAmount: string;
  status: string;
  createdAt: string;
  user: { fullName: string; phone: string; id: number };
  field: { id: number; name: string };
};

export default function OwnerBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'PAST'>('TODAY');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    fetchBookings();
  }, [filterDate, filterStatus]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // Build query string
      let qs = '';
      if (filterStatus !== 'ALL') {
        qs += `&status=${filterStatus}`;
      }
      if (filterDate === 'TODAY' || filterDate === 'TOMORROW') {
        const d = new Date();
        if (filterDate === 'TOMORROW') d.setDate(d.getDate() + 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        qs += `&date=${yyyy}-${mm}-${dd}`;
      }

      const res = await api.get(`/owner/bookings?limit=100${qs}`);
      let data: Booking[] = res.data.bookings || [];

      // Manual filtering for "PAST" since backend date filter exact matches YYYY-MM-DD
      if (filterDate === 'PAST') {
        const todayStr = new Date().toISOString().split('T')[0];
        data = data.filter(b => b.date.split('T')[0] < todayStr);
      } else if (filterDate === 'ALL') {
          // keep all
      }

      setBookings(data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (bookingId: string, action: 'cancel' | 'no-show') => {
    const text = action === 'cancel' 
       ? 'Вы уверены, что хотите отменить эту бронь? Освободившийся слот снова станет доступен для заказа.'
       : 'Отметить неявку (No-Show)? Клиент не пришел на игру в указанное время.';
       
    if (!confirm(text)) return;
    
    try {
      if (action === 'cancel') {
        await api.put(`/owner/bookings/${bookingId}/cancel`);
        toast.success('Бронь отменена');
      } else {
        await api.put(`/owner/bookings/${bookingId}/no-show`);
        toast.success('Неявка зафиксирована');
      }
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при выполнении действия');
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return { label: 'Подтверждено', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 };
      case 'COMPLETED': return { label: 'Завершено', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Flag };
      case 'CANCELLED': return { label: 'Отменено', color: 'bg-red-100 text-red-800 border-red-200', icon: Ban };
      case 'NO_SHOW': return { label: 'Неявка', color: 'bg-gray-100 text-gray-800 border-gray-300', icon: UserX };
      case 'PENDING': return { label: 'Ожидает', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock };
      default: return { label: status, color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Clock };
    }
  };

  return (
    <div className="flex-1 bg-gray-50 flex flex-col min-h-screen">
      
      {/* Header & Tooling */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-6 z-10 sticky top-0 shadow-sm">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Операционная панель</h1>
               <p className="text-sm text-gray-500 mt-1">Управляйте бронированиями, фиксируйте неявки и отмены</p>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
               <div className="bg-gray-100 p-1 flex rounded-xl border border-gray-200">
                 {['ALL', 'TODAY', 'TOMORROW', 'PAST'].map(opt => (
                   <button 
                      key={opt}
                      onClick={() => setFilterDate(opt as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterDate === opt ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                   >
                      {opt === 'ALL' && 'Все'}
                      {opt === 'TODAY' && 'Сегодня'}
                      {opt === 'TOMORROW' && 'Завтра'}
                      {opt === 'PAST' && 'Архив'}
                   </button>
                 ))}
               </div>
               
               <select 
                  value={filterStatus} 
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-green-500"
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
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
               <p className="text-gray-500 text-sm mt-4 font-medium">Загрузка бронирований...</p>
            </div>
         ) : bookings.length === 0 ? (
            <div className="bg-white rounded-[1.5rem] border border-gray-200 border-dashed p-12 text-center text-gray-500 shadow-sm font-medium">
               <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
               По заданным фильтрам бронирований не найдено.
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {bookings.map(b => {
                 const statusConf = getStatusConfig(b.status);
                 const StatusIcon = statusConf.icon;
                 const bookingDateStr = new Date(b.date).toLocaleDateString('ru-RU');
                 const endTime = new Date(new Date(`1970-01-01T${b.startTime}`).getTime() + b.durationMinutes * 60000).toTimeString().substring(0, 5);

                 return (
                   <div key={b.id} className={`bg-white rounded-2xl border transition-all flex flex-col overflow-hidden shadow-sm hover:shadow-md ${b.status === 'CANCELLED' || b.status === 'NO_SHOW' ? 'opacity-70 border-gray-200' : 'border-gray-200'}`}>
                      {/* Top Bar */}
                      <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                         <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${statusConf.color}`}>
                           <StatusIcon className="w-3.5 h-3.5" /> {statusConf.label}
                         </div>
                         <div className="text-xs font-bold text-gray-500 flex items-center gap-1">
                           <CalendarDays className="w-3.5 h-3.5"/> {bookingDateStr}
                         </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex-1">
                         <div className="flex items-start justify-between mb-4">
                            <div>
                               <div className="text-2xl font-extrabold text-gray-900 tracking-tight">{b.startTime.substring(0,5)} - {endTime}</div>
                               <div className="text-sm font-medium text-gray-500 mt-0.5">{b.durationMinutes} минут</div>
                            </div>
                            <div className="text-right">
                               <div className="text-sm font-bold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                                 {Number(b.totalAmount).toLocaleString('ru-RU')} sum
                               </div>
                            </div>
                         </div>
                         
                         <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                               <User className="w-4 h-4 text-gray-400" />
                               <span className="font-bold line-clamp-1">{b.user?.fullName || 'Гость'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                               <Phone className="w-4 h-4 text-gray-400" />
                               <span className="font-medium">{b.user?.phone || 'Не указан'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                               <MapPin className="w-4 h-4 text-gray-400" />
                               <span className="font-medium line-clamp-1 truncate">{b.field?.name}</span>
                            </div>
                         </div>

                      </div>

                      {/* Actions */}
                      {b.status === 'CONFIRMED' && (
                         <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex gap-2">
                            <button 
                               onClick={() => handleAction(b.id, 'no-show')}
                               className="flex-1 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                               <UserX className="w-4 h-4"/> Неявка
                            </button>
                            <button 
                               onClick={() => handleAction(b.id, 'cancel')}
                               className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                            >
                               <Ban className="w-4 h-4"/> Отмена
                            </button>
                         </div>
                      )}
                   </div>
                 );
               })}
            </div>
         )}
      </div>

    </div>
  );
}
