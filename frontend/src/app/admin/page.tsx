'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Clock, MapPin, User, ChevronRight, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminModerationQueuePage() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING'); // PENDING = SUBMITTED + UNDER_REVIEW

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      // If PENDING, we fetch ALL and filter locally, or fetch SUBMITTED then UNDER_REVIEW.
      // Backend supports ?status=ALL
      const res = await api.get(`/admin/moderation?status=ALL`);
      let data = res.data.requests || [];
      
      if (statusFilter === 'PENDING') {
        data = data.filter((r: any) => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status));
      }
      
      setRequests(data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'UNDER_REVIEW': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'NEEDS_REVISION': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'Новая заявка';
      case 'UNDER_REVIEW': return 'На проверке';
      case 'NEEDS_REVISION': return 'Ждет правок';
      case 'APPROVED': return 'Одобрено';
      case 'REJECTED': return 'Отклонено';
      default: return status;
    }
  };

  return (
    <div className="flex-1 bg-gray-50 flex flex-col min-h-screen">
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-6 z-10 sticky top-0 shadow-sm">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Очередь модерации</h1>
               <p className="text-sm text-slate-500 mt-1">Проверка новых площадок и измененных объектов перед публикацией в каталоге.</p>
            </div>
            
            <div className="bg-slate-100 p-1 flex rounded-xl border border-slate-200 w-full md:w-auto">
               <button onClick={() => setStatusFilter('PENDING')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-1 md:flex-none ${statusFilter === 'PENDING' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
                 Ждут проверки
               </button>
               <button onClick={() => setStatusFilter('ALL')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-1 md:flex-none ${statusFilter === 'ALL' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}>
                 Вся история
               </button>
            </div>
         </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
         {loading ? (
           <div className="text-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
           </div>
         ) : requests.length === 0 ? (
           <div className="bg-white rounded-[1.5rem] border border-gray-200 border-dashed p-12 text-center text-slate-500 shadow-sm font-medium">
               <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
               <p className="text-lg text-slate-900 font-bold mb-1">Очередь пуста!</p>
               <p>Нет заявок, ожидающих вашего решения.</p>
           </div>
         ) : (
           <div className="space-y-4">
             {requests.map(req => {
                const isActionNeeded = req.status === 'SUBMITTED' || req.status === 'UNDER_REVIEW';
                
                return (
                  <div key={req.id} className={`bg-white rounded-2xl border transition-all flex flex-col md:flex-row shadow-sm hover:shadow-md ${isActionNeeded ? 'border-indigo-200 shadow-indigo-100' : 'border-slate-200 opacity-80'}`}>
                     
                     {/* Status indicator bar (Left strip) */}
                     <div className={`w-2 flex-shrink-0 rounded-l-2xl ${isActionNeeded ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                     
                     <div className="flex-1 p-5 md:p-6 flex flex-col md:flex-row gap-6">
                        {/* Info Block */}
                        <div className="flex-1">
                           <div className="flex items-center gap-3 mb-2">
                             <div className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusColor(req.status)}`}>
                               {getStatusText(req.status)}
                             </div>
                             <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> Заявка от {new Date(req.submittedAt).toLocaleString('ru-RU')}</span>
                           </div>

                           <h3 className="text-xl font-bold text-slate-900 mb-2">{req.venue?.name || 'Без названия'}</h3>
                           
                           <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-sm">
                             <div className="flex items-center gap-1.5 text-slate-700">
                               <User className="w-4 h-4 text-slate-400" />
                               <span className="font-medium">{req.venue?.owner?.fullName}</span>
                               <span className="text-slate-500 text-xs">({req.venue?.owner?.phone})</span>
                             </div>
                             <div className="flex items-center gap-1.5 text-slate-700">
                               <MapPin className="w-4 h-4 text-slate-400" />
                               <span className="font-medium line-clamp-1">{req.venue?.address}</span>
                             </div>
                           </div>
                        </div>

                        {/* Action Block */}
                        <div className="flex flex-col justify-center items-start md:items-end md:w-48 flex-shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                           <div className="text-sm font-bold text-slate-700 mb-3 text-left md:text-right w-full">
                              <span className="text-2xl">{req.venue?._count?.fields || 0}</span> <span className="text-slate-500">полей</span>
                           </div>
                           <Link 
                              href={`/admin/moderation/${req.id}`}
                              className={`w-full justify-center text-sm font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 
                                ${isActionNeeded ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                           >
                              {isActionNeeded ? 'Начать проверку' : 'Посмотреть'} <ChevronRight className="w-4 h-4" />
                           </Link>
                        </div>
                     </div>
                  </div>
                );
             })}
           </div>
         )}
      </div>

    </div>
  );
}
