'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, XCircle, AlertCircle, 
  MapPin, User, Clock, KeySquare, ChevronRight, Activity 
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminModerationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [reqData, setReqData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Actions State
  const [actionNote, setActionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  const fetchDetail = async () => {
    try {
      const res = await api.get(`/admin/moderation/${params.id}`);
      setReqData(res.data.request);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) router.push('/login');
      else toast.error('Не удалось загрузить заявку');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (type: 'approve' | 'reject' | 'revision') => {
    if ((type === 'reject' || type === 'revision') && !actionNote.trim()) {
      toast.warning('Пожалуйста, укажите причину в комментарии (Moderation Note).');
      return;
    }

    if (!confirm(`Вы уверены, что хотите ${type === 'approve' ? 'ОДОБРИТЬ' : type === 'reject' ? 'ОТКЛОНИТЬ' : 'ВЕРНУТЬ НА ДОРАБОТКУ'} эту заявку?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      let endpoint = `/admin/moderation/${params.id}/${type}`;
      await api.post(endpoint, { note: actionNote });
      toast.success('Решение успешно сохранено');
      router.push('/admin'); // Redirect back to queue
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при сохранении решения');
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'UNDER_REVIEW': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'NEEDS_REVISION': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
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

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!reqData) {
    return <div className="p-8 text-center text-red-500 font-bold">Заявка не найдена</div>;
  }

  const v = reqData.venue;
  const isActionNeeded = reqData.status === 'SUBMITTED' || reqData.status === 'UNDER_REVIEW';

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen">
      
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-5 flex-shrink-0 z-10 sticky top-0 shadow-sm">
         <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/admin')} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
                <ArrowLeft className="w-5 h-5"/>
              </button>
              <div>
                 <div className="flex items-center gap-2 mb-1">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Аудит площадки</span>
                   <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(reqData.status)}`}>
                     {reqData.status}
                   </span>
                 </div>
                 <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{v.name || 'Без названия'}</h1>
              </div>
            </div>
         </div>
      </div>

      <div className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto flex flex-col lg:flex-row gap-8 items-start">
         
         {/* LEFT COLUMN: VENUE INFO */}
         <div className="w-full lg:flex-1 space-y-6">
            
            {/* General Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
                  <h3 className="font-bold text-slate-900">Информационный профиль</h3>
               </div>
               <div className="p-5 space-y-4">
                 <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Адрес</span>
                    <p className="text-sm font-medium text-slate-900 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" /> {v.address} <span className="text-slate-500">({v.city})</span>
                    </p>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Координаты</span>
                    <p className="text-sm font-medium text-slate-900 font-mono">
                      {v.lat}, {v.lng}
                    </p>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Краткое описание</span>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {v.description ? v.description : <span className="italic text-slate-400">Владелец не оставил описание</span>}
                    </p>
                 </div>
                 <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Владелец (Owner)</span>
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                         <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{v.owner?.fullName}</p>
                        <p className="text-xs font-medium text-slate-500">{v.owner?.phone}</p>
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Fields Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><KeySquare className="w-4 h-4 text-slate-500"/> Заявленные поля</h3>
                  <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-md">{v.fields?.length || 0}</span>
               </div>
               <div className="p-3">
                  {v.fields?.length === 0 ? (
                    <div className="p-4 text-center text-sm font-medium text-red-500">Поля отсутствуют. Такую заявку следует отклонить.</div>
                  ) : (
                    <div className="space-y-2">
                       {v.fields?.map((f: any) => (
                         <div key={f.id} className="border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                            <div>
                               <div className="font-bold text-sm text-slate-900 mb-0.5">{f.name}</div>
                               <div className="text-xs font-medium text-slate-500 flex gap-3">
                                 <span>{f.sportCategory?.nameRu || 'Спорт'}</span>
                                 <span>{f.coverageType || 'GRASS'}</span>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 inline-block mb-1">
                                 {Number(f.pricePerHour).toLocaleString('ru-RU')} sum/ч
                               </div>
                               <div className="flex gap-1 justify-end">
                                 {f.hasLighting && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600" title="Освещение">💡</span>}
                                 {f.hasLockerRoom && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-600" title="Раздевалки">🚿</span>}
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>

         </div>

         {/* RIGHT COLUMN: ACTION PANEL */}
         <div className="w-full lg:w-96 flex-shrink-0 space-y-6">
            
            {isActionNeeded ? (
              <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-md overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                 <div className="bg-indigo-50/50 border-b border-indigo-100 px-5 py-4">
                    <h3 className="font-extrabold text-indigo-900 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600"/> Решение модератора</h3>
                 </div>
                 <div className="p-5">
                    <div className="mb-5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Комментарий к заявке (Moderation Note)</label>
                      <textarea 
                         rows={4}
                         placeholder="Укажите замечания, если отклоняете или отправляете на доработку. При одобрении можно оставить пустым."
                         value={actionNote}
                         onChange={e => setActionNote(e.target.value)}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none font-medium text-slate-700"
                      />
                    </div>
                    
                    <div className="space-y-3">
                       <button onClick={() => handleAction('approve')} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50">
                          <CheckCircle2 className="w-5 h-5"/> ОДОБРИТЬ (ОПУБЛИКОВАТЬ)
                       </button>
                       <button onClick={() => handleAction('revision')} disabled={isSubmitting} className="w-full bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                          <AlertCircle className="w-5 h-5"/> ЗАПРОСИТЬ ПРАВКИ
                       </button>
                       <button onClick={() => handleAction('reject')} disabled={isSubmitting} className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                          <XCircle className="w-4 h-4"/> РЕЗКИЙ ОТКАЗ (REJECT)
                       </button>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="bg-slate-100 rounded-2xl border border-slate-200 p-6 text-center shadow-inner">
                 <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                 <h3 className="font-bold text-slate-900 mb-1">Решение уже принято</h3>
                 <p className="text-sm font-medium text-slate-500">Заявка находится в статусе {getStatusText(reqData.status)}. Действия больше не требуются.</p>
                 {reqData.adminNote && (
                   <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg text-left text-sm text-slate-700 italic">
                     <span className="block text-xs font-bold not-italic text-slate-400 uppercase mb-1">Оставленный комментарий:</span>
                     "{reqData.adminNote}"
                   </div>
                 )}
              </div>
            )}

            {/* History Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
                  <h3 className="font-bold text-slate-900 text-sm">История итераций</h3>
               </div>
               <div className="p-1">
                  {v.moderationRequests?.map((ir: any, i: number) => (
                    <div key={ir.id} className="p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(ir.status)}`}>{ir.status}</span>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(ir.submittedAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                      {ir.adminNote && (
                         <div className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100 mt-1">
                           <strong>Note:</strong> {ir.adminNote}
                         </div>
                      )}
                    </div>
                  ))}
               </div>
            </div>

         </div>

      </div>

    </div>
  );
}
