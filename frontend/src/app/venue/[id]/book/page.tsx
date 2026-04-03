'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function BookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fieldId = searchParams.get('field');
  
  const [date, setDate] = useState(() => {
    return searchParams.get('date') || new Date().toISOString().split('T')[0];
  });
  
  const [duration, setDuration] = useState(() => {
    return parseInt(searchParams.get('duration') || '60');
  });
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync state to URL for stability
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', date);
    params.set('duration', duration.toString());
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [date, duration, router, searchParams]);

  useEffect(() => {
    if (!fieldId) return;
    setLoading(true);
    api.get(`/search/field/${fieldId}/slots?date=${date}`)
      .then((res: any) => {
         setSlots(res.data.slots || []);
      })
      .catch((err: any) => {
         console.error(err);
         toast.error('Не удалось загрузить слоты. Возможно бэкенд недоступен.');
      })
      .finally(() => {
         setLoading(false);
      });
  }, [fieldId, date]);

  const handleBooking = async () => {
    if (!selectedSlot || !fieldId) return;
    setIsSubmitting(true);

    try {
      await api.post('/bookings', {
        fieldId: parseInt(fieldId),
        date: date,
        startTime: selectedSlot.startTime,
        durationMinutes: duration,
        totalAmount: 0 // Free for Phase 1 as per rules
      });
      setSuccess(true);
      toast.success('Бронь успешно подтверждена!');
    } catch (err: any) {
      if (err.response) {
        const status = err.response.status;
        const msg = err.response.data?.error || err.response.data?.message;
        
        if (status === 401) {
           toast.info('Для бронирования необходимо войти в аккаунт.');
           const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
           setTimeout(() => router.push(`/login?callbackUrl=${currentUrl}`), 2000);
        } else if (status === 403) {
           toast.warning('Пожалуйста, сначала подтвердите ваш номер телефона.');
           const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
           setTimeout(() => router.push(`/auth/verify?callbackUrl=${currentUrl}`), 2000);
        } else if (status === 409 || msg?.includes('overlap') || msg?.includes('Slot in blackout')) {
           toast.error('К сожалению, этот слот уже занят или недоступен. Выберите другое время.');
        } else if (status === 400 && msg?.includes('active bookings at a time')) {
           toast.warning('Достигнут лимит активных броней (максимум 3). Сначала отыграйте их.');
        } else if (status === 400) {
           toast.error(`Ошибка бронирования: ${msg || 'Проверьте выбранные параметры'}`);
        } else {
           toast.error('Произошла внутренняя ошибка. Попробуйте обновить страницу.');
        }
      } else {
        toast.error('Сетевая ошибка. Проверьте подключение.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full text-center border border-gray-100">
           <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
           </div>
           <h1 className="text-2xl font-bold text-gray-900 mb-2">Бронь подтверждена!</h1>
           <p className="text-gray-500 mb-8">Вы успешно забронировали поле. Вы можете увидеть детали в личном кабинете.</p>
           <Link href="/profile" className="inline-block w-full bg-green-600 text-white font-medium py-3.5 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20">
             Перейти в Мои Брони
           </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/venue/${params.id}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-green-600 transition-colors font-medium text-sm">
            <ArrowLeft className="w-4 h-4" /> Назад к площадке
          </Link>
          <div className="font-bold text-gray-900">Оформление брони</div>
          <div className="w-24"></div> {/* spacer */}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
               
               {/* 1. Date & Duration Settings */}
               <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Параметры игры</h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Дата игры</label>
                       <div className="relative">
                         <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                         <input 
                           type="date" 
                           value={date}
                           onChange={(e) => setDate(e.target.value)}
                           className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all text-gray-900 font-medium"
                         />
                       </div>
                     </div>

                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Длительность</label>
                       <div className="relative">
                         <Clock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                         <select 
                           value={duration}
                           onChange={(e) => setDuration(parseInt(e.target.value))}
                           className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all text-gray-900 font-medium appearance-none"
                         >
                           <option value={60}>1 час</option>
                           <option value={90}>1.5 часа</option>
                           <option value={120}>2 часа</option>
                         </select>
                       </div>
                     </div>
                  </div>
               </div>

               {/* 2. Slot Selection */}
               <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Доступные слоты</h2>
                  <p className="text-sm text-gray-500 mb-6">С учетом длительности ({duration} мин) и тех. буферов поля</p>
                  
                  {loading ? (
                    <div className="h-32 flex items-center justify-center text-green-600 animate-pulse font-medium">
                      Загрузка расписания...
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                      <p className="text-gray-500 font-medium">На выбранную дату нет свободных слотов</p>
                      <button onClick={() => setDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])} className="mt-3 text-green-600 font-semibold hover:underline">
                        Посмотреть на завтра
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                       {slots.map((slot, i) => {
                       // Very basic mock filter for client side UX duration fit:
                          // In real logic, backend must return slots based on requests
                          const isSelected = selectedSlot?.startTime === slot.startTime;
                          const isUnavailable = !slot.isAvailable;
                          
                          return (
                            <button
                               key={i}
                               disabled={isUnavailable}
                               onClick={() => setSelectedSlot(slot)}
                               className={`py-3 rounded-xl text-center transition-all ${
                                 isUnavailable
                                 ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                 : isSelected 
                                   ? 'bg-green-600 text-white shadow-lg shadow-green-600/30 ring-2 ring-green-600 ring-offset-2' 
                                   : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 hover:border-green-300'
                               }`}
                            >
                               <div className="text-base font-bold">{slot.startTime}</div>
                            </button>
                          );
                       })}
                    </div>
                  )}
               </div>

            </div>

            {/* Receipt / Action */}
            <div className="md:col-span-1">
               <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-200 sticky top-24">
                  <h3 className="font-bold text-gray-900 mb-4 text-lg">Ваша бронь</h3>
                  
                  <div className="space-y-3 mb-6 text-sm">
                     <div className="flex justify-between text-gray-600">
                       <span>Дата:</span>
                       <span className="font-medium text-gray-900">{date}</span>
                     </div>
                     <div className="flex justify-between text-gray-600">
                       <span>Время:</span>
                       <span className="font-medium text-gray-900">
                         {selectedSlot ? selectedSlot.startTime : '--:--'}
                       </span>
                     </div>
                     <div className="flex justify-between text-gray-600">
                       <span>Длительность:</span>
                       <span className="font-medium text-gray-900">{duration / 60} ч</span>
                     </div>
                     <div className="pt-3 border-t border-gray-100 flex justify-between">
                       <span className="text-gray-900 font-bold">К оплате (на месте)</span>
                       <span className="text-green-700 font-extrabold text-lg">
                         {/* Default price calc, will sync with DB logic later */}
                         {selectedSlot?.priceAmount ? (selectedSlot.priceAmount * (duration/60)).toLocaleString('ru-RU') : '0'} sum
                       </span>
                     </div>
                  </div>

                  <button 
                    disabled={!selectedSlot || isSubmitting}
                    onClick={handleBooking}
                    className="w-full bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-4 rounded-xl hover:bg-green-700 transition-colors"
                  >
                    {isSubmitting ? 'Оформляем...' : 'Подтвердить бронь'}
                  </button>
                  <p className="text-xs text-center text-gray-400 mt-4">
                    Нажимая кнопку, вы соглашаетесь с правилами отмены выбранного поля.
                  </p>
               </div>
            </div>
         </div>
      </main>
    </div>
  );
}
