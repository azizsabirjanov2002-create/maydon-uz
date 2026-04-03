'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, CheckCircle2, Clock, XCircle, AlertCircle, 
  Search, Power, User, ShieldCheck, ChevronRight
} from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminVenuesCatalogue() {
  const router = useRouter();
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterVisibility, setFilterVisibility] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchVenues();
  }, [filterStatus, filterVisibility]);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      let url = `/admin/venues?limit=200`;
      if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
      if (filterVisibility !== 'ALL') url += `&isActive=${filterVisibility === 'VISIBLE'}`;

      const res = await api.get(url);
      setVenues(res.data.venues || []);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (venueId: number, currentStatus: string, currentIsActive: boolean) => {
    if (currentStatus !== 'APPROVED') {
      alert('Принудительное отключение доступно только для объектов со статусом APPROVED (прошедших модерацию).');
      return;
    }

    if (!confirm(`Вы уверены, что хотите ${currentIsActive ? 'ОТКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ'} площадку? ${
      currentIsActive ? 'Она исчезнет из поиска для клиентов.' : 'Она вернется в поиск.'
    }`)) {
      return;
    }

    try {
      await api.put(`/admin/venues/${venueId}/toggle`);
      fetchVenues();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка при переключении статуса');
    }
  };

  const getVisibilityBadge = (v: any) => {
    if (v.isActive && v.status === 'APPROVED') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border bg-green-50 text-green-700 border-green-200">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> В поиске
        </div>
      );
    }
    
    // Hidden reasons
    let reason = '';
    if (v.status === 'UNDER_REVIEW') reason = 'На проверке';
    else if (v.status === 'NEEDS_REVISION') reason = 'Нужны правки';
    else if (v.status === 'REJECTED') reason = 'Отклонен модератором';
    else if (v.status === 'DRAFT') reason = 'Не опубликован (Черновик)';
    else if (v.status === 'SUBMITTED') reason = 'Ждет очереди';
    else if (v.status === 'APPROVED' && !v.isActive) reason = 'Скрыт администратором';

    return (
       <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border bg-slate-100 text-slate-600 border-slate-200" title={reason}>
          <Clock className="w-3.5 h-3.5" /> Скрыт ({reason})
       </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'UNDER_REVIEW': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'NEEDS_REVISION': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const filteredVenues = venues.filter(v => {
    if (!searchQuery) return true;
    const lower = searchQuery.toLowerCase();
    return v.name?.toLowerCase().includes(lower) || 
           v.owner?.fullName?.toLowerCase().includes(lower) ||
           v.city?.toLowerCase().includes(lower);
  });

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-screen">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-6 z-10 sticky top-0 shadow-sm">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Каталог площадок</h1>
               <p className="text-sm text-slate-500 mt-1">Глобальный реестр объектов. Управление видимостью на платформе.</p>
            </div>
         </div>

         {/* Filters Row */}
         <div className="max-w-6xl mx-auto mt-6 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Поиск по названию, владельцу или городу..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              />
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
               <select value={filterVisibility} onChange={e => setFilterVisibility(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0">
                  <option value="ALL">Вся видимость</option>
                  <option value="VISIBLE">В поиске (Публичные)</option>
                  <option value="HIDDEN">Скрытые из поиска</option>
               </select>

               <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0">
                  <option value="ALL">Все статусы модерации</option>
                  <option value="APPROVED">Одобрены (APPROVED)</option>
                  <option value="UNDER_REVIEW">На проверке (REVIEW)</option>
                  <option value="NEEDS_REVISION">Требуют правок (REVISION)</option>
                  <option value="REJECTED">Отклонены (REJECTED)</option>
               </select>
            </div>
         </div>
      </div>

      {/* Catalogue List */}
      <div className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
         {loading ? (
           <div className="text-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
           </div>
         ) : filteredVenues.length === 0 ? (
           <div className="bg-white rounded-[1.5rem] border border-slate-200 border-dashed p-12 text-center text-slate-500 shadow-sm font-medium">
               <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
               <p className="text-lg text-slate-900 font-bold mb-1">Ничего не найдено</p>
               <p>По вашим фильтрам нет подходящих площадок.</p>
           </div>
         ) : (
           <div className="space-y-3">
             {filteredVenues.map(v => (
                <div key={v.id} className="bg-white rounded-2xl border border-slate-200 flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow overflow-hidden items-stretch">
                   
                   {/* Left Info */}
                   <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        {getVisibilityBadge(v)}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(v.status)}`}>
                           {v.status}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-extrabold text-slate-900 mb-1 leading-tight">{v.name || 'Без названия'}</h3>
                      
                      <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> {v.city || 'Город не указан'}</span>
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5"/> {v.owner?.fullName}</span>
                      </div>
                   </div>

                   {/* Stats */}
                   <div className="w-full md:w-48 bg-slate-50/50 p-5 flex flex-row md:flex-col items-center justify-around md:justify-center gap-2 border-b md:border-b-0 md:border-r border-slate-100">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Полей</p>
                        <p className="text-lg font-extrabold text-slate-800 leading-none">{v._count?.fields || 0}</p>
                      </div>
                      <div className="hidden md:block w-8 h-px bg-slate-200"></div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Броней</p>
                        <p className="text-lg font-extrabold text-indigo-700 leading-none">{v._count?.bookings || 0}</p>
                      </div>
                   </div>

                   {/* Actions */}
                   <div className="p-5 flex flex-col justify-center gap-3 md:w-56 shrink-0 bg-white">
                      
                      <button 
                        onClick={() => handleToggleActive(v.id, v.status, v.isActive)}
                        className={`w-full font-bold px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-colors text-xs
                           ${v.status !== 'APPROVED' 
                             ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-50' 
                             : v.isActive 
                               ? 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300' 
                               : 'bg-green-600 text-white border-transparent hover:bg-green-700 shadow-sm'
                           }
                        `}
                        title={v.status !== 'APPROVED' ? 'Нельзя включить: объект не прошел модерацию' : ''}
                      >
                         <Power className="w-4 h-4"/> 
                         {v.isActive ? 'Скрыть с платформы' : 'Вернуть в поиск'}
                      </button>

                   </div>

                </div>
             ))}
           </div>
         )}
      </div>

    </div>
  );
}
