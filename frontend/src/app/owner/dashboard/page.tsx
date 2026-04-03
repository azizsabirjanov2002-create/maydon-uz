'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, CalendarDays, KeySquare, CreditCard, 
  AlertCircle, ChevronRight, CheckCircle2, Clock, MapPin 
} from 'lucide-react';
import { api } from '@/lib/api';

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const [dashRes, venuesRes] = await Promise.all([
        api.get('/owner/dashboard'),
        api.get('/owner/venues')
      ]);
      setData(dashRes.data.dashboard);
      setVenues(venuesRes.data.venues || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center bg-gray-50 flex items-center justify-center">
         <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    );
  }

  // Calculate some quick insights based on venues
  const venuesUnderReview = venues.filter(v => v.status === 'UNDER_REVIEW' || v.status === 'NEEDS_REVISION');
  const venuesRejected = venues.filter(v => v.status === 'REJECTED');
  const upcoming = data?.upcomingBookings?.slice(0, 5) || [];

  return (
    <div className="flex-1 bg-gray-50 flex flex-col min-h-screen p-4 md:p-8">
      
      <div className="max-w-6xl mx-auto w-full">
         <div className="mb-8">
           <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Обзор за день</h1>
           <p className="text-gray-500 mt-1">Оперсводка по загрузке объектов на {new Date().toLocaleDateString('ru-RU')}</p>
         </div>

         {/* TOP STATS CARDS */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
               <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-6 h-6 text-green-600" />
               </div>
               <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Игр сегодня</p>
                  <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{data?.todayBookingsCount || 0}</h3>
               </div>
            </div>

            <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
               <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-blue-600" />
               </div>
               <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Сумма за сегодня</p>
                  <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{(data?.todayTotalAmount || 0).toLocaleString('ru-RU')} sum</h3>
               </div>
            </div>

            <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
               <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <KeySquare className="w-6 h-6 text-amber-600" />
               </div>
               <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Активные поля</p>
                  <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{data?.activeFieldsCount || 0}</h3>
               </div>
            </div>
         </div>

         {/* VENUE ALERTS */}
         {(venuesUnderReview.length > 0 || venuesRejected.length > 0) && (
           <div className="mb-8 space-y-3">
             {venuesUnderReview.map((v: any) => (
               <div key={v.id} className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <p className="font-bold text-orange-900">Площадка «{v.name}» требует внимания</p>
                      <p className="text-sm text-orange-800">{v.status === 'UNDER_REVIEW' ? 'Находится на проверке у администратора и скрыта из поиска.' : 'Модератор запросил правки. Объект скрыт.'}</p>
                    </div>
                  </div>
                  <Link href={`/owner/venues/${v.id}`} className="flex-shrink-0 bg-white hover:bg-orange-100 text-orange-700 text-sm font-bold px-4 py-2 rounded-lg border border-orange-200 transition-colors">
                     Перейти
                  </Link>
               </div>
             ))}
             {venuesRejected.map((v: any) => (
               <div key={v.id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <p className="font-bold text-red-900">Отклонено модератором: «{v.name}»</p>
                      <p className="text-sm text-red-800">Объект не прошел проверку. Зайдите, чтобы прочитать комментарий.</p>
                    </div>
                  </div>
                  <Link href={`/owner/venues/${v.id}`} className="flex-shrink-0 bg-white hover:bg-red-100 text-red-700 text-sm font-bold px-4 py-2 rounded-lg border border-red-200 transition-colors">
                     Изучить
                  </Link>
               </div>
             ))}
           </div>
         )}

         {/* TWO COLUMNS */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* UPCOMING BOOKINGS */}
            <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
               <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">Ближайшие прибытия</h3>
                  <Link href="/owner/bookings" className="text-sm text-green-600 hover:text-green-700 font-bold flex items-center">
                    Все брони <ChevronRight className="w-4 h-4 ml-0.5"/>
                  </Link>
               </div>
               <div className="p-2">
                  {upcoming.length === 0 ? (
                     <div className="p-8 text-center text-gray-500 text-sm font-medium">Нет предстоящих игр на ближайшее время.</div>
                  ) : (
                     upcoming.map((b: any) => (
                        <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 sm:py-3 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0 border-transparent">
                           <div className="flex items-start gap-3 mb-2 sm:mb-0">
                              <div className="w-10 h-10 rounded-lg bg-green-100 text-green-800 flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                                {b.startTime.substring(0,5)}
                              </div>
                              <div>
                                 <p className="font-bold text-gray-900 text-sm">{b.field?.name} <span className="text-gray-400 font-normal">({b.field?.venue?.name})</span></p>
                                 <p className="text-xs text-gray-500 font-medium">{b.user?.fullName} • {b.user?.phone}</p>
                              </div>
                           </div>
                           <div className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md self-start sm:self-center border border-green-100 shrink-0">
                             Подтверждено
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* VENUES SHORT LIST */}
            <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
               <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-900">Ваши объекты</h3>
                  <Link href="/owner/venues" className="text-sm text-green-600 hover:text-green-700 font-bold flex items-center">
                    Управление <ChevronRight className="w-4 h-4 ml-0.5"/>
                  </Link>
               </div>
               <div className="p-2">
                  {venues.length === 0 ? (
                     <div className="p-8 text-center text-gray-500 text-sm font-medium">Нет объектов. Создайте первую площадку.</div>
                  ) : (
                     venues.slice(0, 5).map((v: any) => {
                       const isVisible = v.status === 'APPROVED' && v.isActive;
                       return (
                         <div key={v.id} className="flex items-center justify-between p-3 sm:px-4 sm:py-3 hover:bg-gray-50 rounded-xl transition-colors">
                            <div>
                               <p className="font-bold text-gray-900 text-sm line-clamp-1">{v.name || 'Без названия'}</p>
                               <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                                 <MapPin className="w-3.h-3"/> {v.city}
                               </p>
                            </div>
                            <div>
                               {isVisible ? (
                                 <span className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 className="w-3.5 h-3.5"/> В поиске</span>
                               ) : (
                                 <span className="flex items-center gap-1 text-xs font-bold text-gray-400"><Clock className="w-3.5 h-3.5"/> Скрыто</span>
                               )}
                            </div>
                         </div>
                       )
                     })
                  )}
               </div>
            </div>

         </div>

      </div>
    </div>
  );
}
