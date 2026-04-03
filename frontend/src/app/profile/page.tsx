'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Clock, XCircle, LogOut, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = () => {
    setLoading(true);
    api.get('/profile/bookings')
      .then((res: any) => {
        setBookings(res.data.bookings || []);
      })
      .catch((err: any) => {
        if (err.response?.status !== 401) {
           toast.error('Не удалось загрузить брони. Попробуйте позже.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Вы уверены, что хотите отменить эту бронь?')) return;
    setCancelingId(id);
    try {
      await api.delete(`/bookings/${id}/cancel`);
      // Update UI optimistically or refetch
      setBookings(bookings.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
      toast.success('Бронь успешно отменена');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при отмене брони');
    } finally {
      setCancelingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Profile Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-xl shadow-md">M</div>
            <span className="font-bold text-xl tracking-tight text-gray-900 hidden md:block">Maydon.uz</span>
          </Link>
          <div className="flex items-center gap-4">
             <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-500 font-medium hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
               <LogOut className="w-4 h-4" /> Выйти
             </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
           <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Личный кабинет</h1>
           <p className="text-gray-500">Управляйте вашими бронированиями и профилем</p>
        </div>

        <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-6 border-b border-gray-100 flex justify-between items-center">
             <h2 className="text-xl font-bold text-gray-900">Мои бронирования</h2>
             <Link href="/search" className="text-sm bg-green-50 text-green-700 font-medium px-4 py-2 rounded-xl hover:bg-green-100 transition-colors">
               Забронировать еще
             </Link>
           </div>

           {loading ? (
             <div className="p-12 text-center text-green-600 font-medium animate-pulse">
               Загрузка данных...
             </div>
           ) : bookings.length === 0 ? (
             <div className="p-16 text-center">
               <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Calendar className="w-8 h-8 text-gray-300" />
               </div>
               <h3 className="text-lg font-bold text-gray-900 mb-2">У вас пока нет броней</h3>
               <p className="text-gray-500 max-w-sm mx-auto mb-6">Найдите лучшую площадку и забронируйте ее для вашей следующей игры!</p>
             </div>
           ) : (
             <div className="divide-y divide-gray-100">
               {bookings.map((booking) => (
                 <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                   <div className="flex flex-col md:flex-row justify-between gap-4">
                      
                      {/* Info */}
                      <div className="flex items-start gap-4">
                         <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 relative">
                           {booking.field?.venue?.photos?.[0] && (
                             // eslint-disable-next-line @next/next/no-img-element
                             <img src={booking.field.venue.photos[0]} alt="" className="w-full h-full object-cover" />
                           )}
                         </div>
                         <div>
                           <div className="flex items-center gap-2 mb-1">
                             <h3 className="font-bold text-gray-900 text-lg">{booking.field?.venue?.name || 'Площадка удалена'}</h3>
                             {booking.status === 'CONFIRMED' && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Активна</span>}
                             {booking.status === 'CANCELLED' && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">Отменена</span>}
                             {booking.status === 'COMPLETED' && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-bold">Завершена</span>}
                           </div>
                           <p className="text-sm text-gray-500 mb-2">{booking.field?.name}</p>
                           
                           <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-700">
                             <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400"/> {new Date(booking.date).toLocaleDateString('ru-RU')}</div>
                             <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 rounded-md"><Clock className="w-4 h-4"/> {booking.startTime} - {booking.endTime}</div>
                             <div className="flex items-center gap-1.5 hidden sm:flex"><MapPin className="w-4 h-4 text-gray-400"/> {booking.field?.venue?.address}</div>
                           </div>
                         </div>
                      </div>

                      {/* Actions & Price */}
                      <div className="flex flex-row md:flex-col justify-between items-center md:items-end border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
                         <div className="text-right">
                           <div className="text-xs text-gray-500">К оплате</div>
                           <div className="font-extrabold text-gray-900">{booking.totalAmount?.toLocaleString('ru-RU')} sum</div>
                         </div>
                         {booking.status === 'CONFIRMED' && (
                           <button onClick={() => handleCancel(booking.id)} disabled={cancelingId === booking.id} className="flex items-center gap-1 text-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                             <XCircle className="w-4 h-4" /> {cancelingId === booking.id ? 'Отмена...' : 'Отменить'}
                           </button>
                         )}
                      </div>

                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </main>
    </div>
  );
}
