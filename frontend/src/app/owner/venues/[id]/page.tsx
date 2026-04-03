'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Activity, CheckCircle2, AlertCircle, Clock, XCircle, 
  MapPin, Send, Info, CalendarDays, KeySquare, Plus, Save, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const DEFAULT_SCHEDULE = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  openTime: '08:00',
  closeTime: '23:00',
  isClosed: false
}));

const DAYS_MAP = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export default function VenueManagementPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'FIELDS' | 'BLACKOUTS'>('GENERAL');
  
  // General Info State
  const [generalData, setGeneralData] = useState({ name: '', address: '', description: '', city: 'Tashkent', district: '', lat: 41.2995, lng: 69.2401 });
  const [isGeneralSaving, setIsGeneralSaving] = useState(false);

  // Fields State
  const [selectedFieldId, setSelectedFieldId] = useState<number | 'NEW' | null>(null);
  const [fieldData, setFieldData] = useState<any>({});
  const [fieldSchedules, setFieldSchedules] = useState<any[]>([]);
  const [isFieldSaving, setIsFieldSaving] = useState(false);
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  
  // Blackouts State
  const [fieldBlackouts, setFieldBlackouts] = useState<any[]>(null as any);
  const [isBlackoutsLoading, setIsBlackoutsLoading] = useState(false);
  const [newBlackout, setNewBlackout] = useState({ startDate: '', startTime: '08:00', endDate: '', endTime: '20:00', reason: '' });
  const [isBlackoutSaving, setIsBlackoutSaving] = useState(false);

  useEffect(() => {
    fetchVenue();
  }, [params.id]);

  const fetchVenue = async () => {
    try {
      const res = await api.get(`/owner/venues/${params.id}`);
      const v = res.data.venue;
      setVenue(v);
      setGeneralData({
        name: v.name, address: v.address, description: v.description || '', 
        city: v.city || 'Tashkent', district: v.district || '', lat: v.lat || 41.2995, lng: v.lng || 69.2401
      });
      
      // Auto-select first field if none selected
      if (v.fields && v.fields.length > 0 && !selectedFieldId) {
         selectField(v.fields[0]);
      } else if (selectedFieldId && selectedFieldId !== 'NEW') {
         // Update existing selection with fresh data
         const freshField = v.fields.find((f: any) => f.id === selectedFieldId);
         if (freshField) selectField(freshField);
      }
    } catch (err: any) {
      if (err.response?.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const selectField = (f: any) => {
    setSelectedFieldId(f.id);
    setFieldData({
      name: f.name,
      pricePerHour: f.pricePerHour,
      coverageType: f.coverageType || 'GRASS',
      bufferMinutes: f.bufferMinutes || 15,
      maxBookingHours: f.maxBookingHours || 3,
      isActive: f.isActive ?? true,
      hasLighting: f.hasLighting || false,
      hasLockerRoom: f.hasLockerRoom || false,
      hasShower: f.hasShower || false,
      hasParking: f.hasParking || false,
    });
    
    // Sort schedules by dayOfWeek or fallback to default
    if (f.schedules && f.schedules.length > 0) {
      const sorted = [...f.schedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      setFieldSchedules(sorted);
    } else {
      setFieldSchedules(DEFAULT_SCHEDULE);
    }
  };

  useEffect(() => {
    if (activeTab === 'BLACKOUTS' && typeof selectedFieldId === 'number') {
      fetchBlackouts(selectedFieldId);
    }
  }, [activeTab, selectedFieldId]);

  const fetchBlackouts = async (fId: number) => {
    setIsBlackoutsLoading(true);
    try {
      const res = await api.get(`/owner/fields/${fId}/blackouts`);
      setFieldBlackouts(res.data.blackouts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBlackoutsLoading(false);
    }
  };

  const handleAddNewField = () => {
    setSelectedFieldId('NEW');
    setFieldData({
      name: 'Новое поле',
      sportCategoryId: 1, // Default to Football for now
      pricePerHour: 150000,
      coverageType: 'GRASS',
      bufferMinutes: 15,
      maxBookingHours: 3,
      isActive: true,
      hasLighting: false,
      hasLockerRoom: false,
      hasShower: false,
      hasParking: false,
    });
    setFieldSchedules([]); // Cannot set schedules until created
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT': return { label: 'Черновик', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
      case 'SUBMITTED': return { label: 'Отправлен', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Activity };
      case 'UNDER_REVIEW': return { label: 'На проверке', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle };
      case 'APPROVED': return { label: 'Одобрен', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 };
      case 'NEEDS_REVISION': return { label: 'Нужны правки', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertCircle };
      case 'REJECTED': return { label: 'Отклонен', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle };
      default: return { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
    }
  };

  /* ================= HANDLERS ================= */
  const handleSubmitModeration = async () => {
    setSubmitting(true);
    try {
      await api.post(`/owner/venues/${params.id}/submit`);
      toast.success('Площадка отправлена на модерацию');
      fetchVenue();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при отправке');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGeneral = async () => {
    setIsGeneralSaving(true);
    try {
      const res = await api.put(`/owner/venues/${params.id}`, generalData);
      if (res.data.reModerationTriggered) {
        toast.warning('Площадка отправлена на проверку из-за изменения критичных полей.');
      } else {
        toast.success('Информация сохранена');
      }
      fetchVenue();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setIsGeneralSaving(false);
    }
  };

  const handleSaveFieldProps = async () => {
    setIsFieldSaving(true);
    try {
      if (selectedFieldId === 'NEW') {
        const res = await api.post(`/owner/venues/${params.id}/fields`, fieldData);
        setSelectedFieldId(res.data.field.id);
      } else {
        await api.put(`/owner/fields/${selectedFieldId}`, fieldData);
      }
      fetchVenue();
      toast.success('Поле успешно сохранено!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка сохранения поля');
    } finally {
      setIsFieldSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (selectedFieldId === 'NEW' || !selectedFieldId) return;
    setIsScheduleSaving(true);
    try {
      const payload = fieldSchedules.map(s => ({
        dayOfWeek: s.dayOfWeek,
        openTime: s.openTime,
        closeTime: s.closeTime,
        isClosed: s.isClosed
      }));
      await api.put(`/owner/fields/${selectedFieldId}/schedule`, { schedules: payload });
      fetchVenue();
      toast.success('Расписание успешно сохранено!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка сохранения расписания. Проверьте валидность.');
    } finally {
      setIsScheduleSaving(false);
    }
  };

  const scheduleChange = (index: number, key: string, value: any) => {
    const newSched = [...fieldSchedules];
    newSched[index] = { ...newSched[index], [key]: value };
    setFieldSchedules(newSched);
  };

  const handleCreateBlackout = async () => {
    if (!selectedFieldId || selectedFieldId === 'NEW') return;
    if (!newBlackout.startDate || !newBlackout.endDate) {
      toast.warning('Укажите начальную и конечную дату');
      return;
    }
    
    const startAt = `${newBlackout.startDate}T${newBlackout.startTime}:00+05:00`;
    const endAt = `${newBlackout.endDate}T${newBlackout.endTime}:00+05:00`;

    setIsBlackoutSaving(true);
    try {
      await api.post(`/owner/fields/${selectedFieldId}/blackouts`, {
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: newBlackout.reason || undefined
      });
      setNewBlackout({ startDate: '', startTime: '08:00', endDate: '', endTime: '20:00', reason: '' });
      fetchBlackouts(selectedFieldId);
      toast.success('Время заблокировано');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка создания блокировки');
    } finally {
      setIsBlackoutSaving(false);
    }
  };

  const handleDeleteBlackout = async (blackoutId: number) => {
    if (!confirm('Отменить эту блокировку?')) return;
    try {
      await api.delete(`/owner/blackouts/${blackoutId}`);
      toast.success('Блокировка отменена');
      if (typeof selectedFieldId === 'number') fetchBlackouts(selectedFieldId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка удаления');
    }
  };


  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse font-medium">Загрузка панели управления...</div>;
  }
  if (!venue) {
    return <div className="p-8 text-center text-red-500">Объект не найден</div>;
  }

  const statusConf = getStatusConfig(venue.status);
  const StatusIcon = statusConf.icon;
  const isPubliclyVisible = venue.status === 'APPROVED' && venue.isActive;
  const modNote = venue.moderationRequests?.[0]?.notes;
  const canSubmit = ['DRAFT', 'NEEDS_REVISION'].includes(venue.status) && venue.fields?.length > 0;

  return (
    <div className="flex-1 bg-gray-50 flex flex-col min-h-screen">
      
      {/* --- STATUS HEADER ZONE --- */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-5 flex-shrink-0 z-10 sticky top-0 shadow-sm">
         <div className="max-w-6xl mx-auto">
            <button onClick={() => router.push('/owner/venues')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm font-medium mb-4 transition-colors">
               <ArrowLeft className="w-4 h-4" /> Назад к списку
            </button>
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
               <div>
                  <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">{venue.name || 'Без названия'}</h1>
                  
                  <div className="flex flex-wrap items-center gap-3">
                     <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${statusConf.color}`}>
                       <StatusIcon className="w-4 h-4" /> {statusConf.label}
                     </div>
                     <div className="h-4 w-px bg-gray-300" />
                     {isPubliclyVisible ? (
                       <span className="text-sm font-medium text-green-600 flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded-md"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Опубликовано в каталоге</span>
                     ) : (
                       <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5 bg-gray-100 px-2 py-0.5 rounded-md"><div className="w-2 h-2 rounded-full bg-gray-400" /> Скрыто из публичного поиска</span>
                     )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {venue.address}
                  </p>
               </div>

               <div className="flex-shrink-0 text-right">
                 <button 
                   onClick={handleSubmitModeration}
                   disabled={!canSubmit || submitting}
                   className="bg-gray-900 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 w-full md:w-auto shadow-md"
                 >
                   <Send className="w-4 h-4" />
                   {venue.status === 'DRAFT' ? 'Отправить на модерацию' : 
                    ['SUBMITTED', 'UNDER_REVIEW'].includes(venue.status) ? 'На проверке' :
                    venue.status === 'APPROVED' ? 'Модерация пройдена' :
                    'Повторно отправить'}
                 </button>
                 {venue.fields?.length === 0 && venue.status === 'DRAFT' && (
                    <div className="text-xs text-red-500 mt-2">Нужно добавить минимум 1 поле</div>
                 )}
               </div>
            </div>

            {/* Moderation Notes Block */}
            {modNote && ['NEEDS_REVISION', 'REJECTED'].includes(venue.status) && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 text-orange-800 text-sm">
                <Info className="w-5 h-5 flex-shrink-0 text-orange-500 mt-0.5" />
                <div>
                  <span className="font-bold block mb-1">Комментарий модератора:</span>
                  {modNote}
                </div>
              </div>
            )}
         </div>
      </div>

      {/* --- QUICK SUMMARY --- */}
      <div className="px-4 md:px-8 py-4 bg-white/50 border-b border-gray-100">
         <div className="max-w-6xl mx-auto flex flex-wrap gap-6 text-sm">
            <div className="flex gap-2 items-center"><KeySquare className="w-4 h-4 text-gray-400"/> <strong>{venue.fields?.length || 0}</strong> полей</div>
            <div className="flex gap-2 items-center"><CalendarDays className="w-4 h-4 text-gray-400"/> <strong>{venue.fields?.reduce((acc: number, f: any) => acc + (f._count?.bookings || 0), 0) || 0}</strong> активных броней</div>
         </div>
      </div>

      {/* --- TABS NAV & CONTENT --- */}
      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto w-full flex-1 flex flex-col">
         <div className="flex gap-1 mb-6 bg-gray-100/50 p-1 rounded-xl w-max border border-gray-200/50">
            <button onClick={() => setActiveTab('GENERAL')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'GENERAL' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-800'}`}>
              Общая информация
            </button>
            <button onClick={() => setActiveTab('FIELDS')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'FIELDS' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-800'}`}>
              Поля и Расписание
            </button>
            <button onClick={() => setActiveTab('BLACKOUTS')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'BLACKOUTS' ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-800'}`}>
              Блокировки (Blackouts)
            </button>
         </div>

         {/* --- TAB: GENERAL --- */}
         {activeTab === 'GENERAL' && (
           <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm max-w-3xl">
              <div className="mb-6 bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100 flex gap-3 text-sm flex-col md:flex-row">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Изменение этих данных отправит площадку на повторную модерацию</strong> и временно скроет её из поиска. Бронирования и управление при этом не пострадают.
                </div>
              </div>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Название объекта</label>
                    <input 
                      type="text" value={generalData.name} onChange={(e) => setGeneralData({...generalData, name: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-100 outline-none transition-all text-gray-800 font-medium"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Точный адрес (Улица, Дом)</label>
                    <input 
                      type="text" value={generalData.address} onChange={(e) => setGeneralData({...generalData, address: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-100 outline-none transition-all text-gray-800 font-medium"
                    />
                 </div>
                 <div className="pt-4 border-t border-gray-100 mt-2">
                    <button onClick={handleSaveGeneral} disabled={isGeneralSaving} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm shadow-green-600/20">
                      {isGeneralSaving ? 'Сохранение...' : <><Save className="w-4 h-4"/> Сохранить информацию</>}
                    </button>
                 </div>
              </div>
           </div>
         )}

         {/* --- TAB: FIELDS --- */}
         {activeTab === 'FIELDS' && (
           <div className="flex flex-col lg:flex-row gap-6 h-auto min-h-[600px] items-stretch">
              
              {/* Fields List Sidebar */}
              <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden h-[600px] sticky top-6">
                 <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-gray-900">Поля ({venue.fields?.length || 0})</h3>
                    <button onClick={handleAddNewField} className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-lg hover:bg-green-600 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                 </div>
                 <div className="overflow-y-auto flex-1 p-2 space-y-1">
                    {selectedFieldId === 'NEW' && (
                      <button className="w-full text-left p-3 rounded-xl transition-all border bg-green-50 border-green-200 text-green-900 shadow-sm">
                         <div className="font-bold text-sm mb-0.5">Новое поле</div>
                         <div className="text-xs opacity-70">Не сохранено</div>
                      </button>
                    )}
                    {venue.fields?.map((f: any) => (
                      <button 
                         key={f.id} onClick={() => selectField(f)}
                         className={`w-full text-left p-3 rounded-xl transition-all border ${
                           selectedFieldId === f.id 
                           ? 'bg-green-50 border-green-200 text-green-900 shadow-sm'
                           : 'border-transparent text-gray-700 hover:bg-gray-50'
                         }`}
                      >
                         <div className="flex justify-between items-start">
                            <span className="font-bold text-sm mb-0.5 line-clamp-1">{f.name}</span>
                            {!f.isActive && <span className="w-2 h-2 rounded-full bg-red-400 mt-1 flex-shrink-0" title="Выключено" />}
                         </div>
                         <div className="text-xs opacity-70">{f.pricePerHour.toLocaleString('ru-RU')} sum / час</div>
                      </button>
                    ))}
                 </div>
              </div>

              {/* Field Properties & Schedule Panel */}
              <div className="flex-1 bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-6 overflow-hidden flex flex-col items-stretch">
                 {selectedFieldId ? (
                   <div className="flex-1">
                     
                     {/* Form Settings */}
                     <div className="border-b border-gray-100 pb-6 mb-6">
                       <div className="flex justify-between items-center mb-6">
                          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            {selectedFieldId === 'NEW' ? 'Создать поле' : 'Редактировать поле'}
                            {!fieldData.isActive && <span className="bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium ml-2">Выключено</span>}
                          </h2>
                          <button onClick={handleSaveFieldProps} disabled={isFieldSaving} className="text-sm bg-gray-900 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:bg-gray-300">
                             {isFieldSaving ? '...' : <><Save className="w-4 h-4"/> Сохранить поле</>}
                          </button>
                       </div>

                       <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Название поля</label>
                                <input type="text" value={fieldData.name || ''} onChange={e => setFieldData({...fieldData, name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Цена за час (sum)</label>
                                <input type="number" min="0" value={fieldData.pricePerHour || ''} onChange={e => setFieldData({...fieldData, pricePerHour: parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                             </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Покрытие</label>
                                <select value={fieldData.coverageType || 'GRASS'} onChange={e => setFieldData({...fieldData, coverageType: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                                  <option value="GRASS">Натур. газон</option><option value="ARTIFICIAL">Искусст. газон</option><option value="PARQUET">Паркет</option><option value="CONCRETE">Бетон</option><option value="SAND">Песок</option><option value="OTHER">Другое</option>
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Буфер (мин)</label>
                                <select value={fieldData.bufferMinutes || 0} onChange={e => setFieldData({...fieldData, bufferMinutes: parseInt(e.target.value)})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none">
                                  <option value="0">0 мин</option><option value="10">10 мин</option><option value="15">15 мин</option><option value="20">20 мин</option>
                                </select>
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Макс. бронь (ч)</label>
                                <input type="number" min="1" max="8" value={fieldData.maxBookingHours || 3} onChange={e => setFieldData({...fieldData, maxBookingHours: parseInt(e.target.value)})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Только чтение</label>
                                <div className="mt-1 flex items-center h-10 w-full px-4 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden cursor-pointer" onClick={() => setFieldData({...fieldData, isActive: !fieldData.isActive})}>
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 ${fieldData.isActive ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`}>
                                    {fieldData.isActive && <CheckCircle2 className="w-3 h-3 text-white" />}
                                  </div>
                                  <span className="text-sm">Активно</span>
                                </div>
                             </div>
                          </div>

                          <div className="pt-2">
                             <label className="block text-sm font-medium text-gray-700 mb-2 ml-1">Удобства на поле</label>
                             <div className="flex flex-wrap gap-3">
                                {[
                                  { k: 'hasLighting', l: 'Освещение' }, { k: 'hasLockerRoom', l: 'Раздевалки' },
                                  { k: 'hasShower', l: 'Душевые' }, { k: 'hasParking', l: 'Парковка' }
                                ].map(item => (
                                  <button key={item.k} onClick={() => setFieldData({...fieldData, [item.k]: !fieldData[item.k]})} className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${fieldData[item.k] ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                    {fieldData[item.k] && <CheckCircle2 className="w-3.5 h-3.5" />} {item.l}
                                  </button>
                                ))}
                             </div>
                          </div>
                       </div>
                     </div>

                     {/* Schedule Editor (Only if not NEW) */}
                     {selectedFieldId === 'NEW' ? (
                       <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500 text-sm">
                         Сначала сохраните поле, чтобы настроить для него рабочее расписание.
                       </div>
                     ) : (
                       <div>
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 border-l-4 border-green-500 pl-3">Настройка расписания</h3>
                            <button onClick={handleSaveSchedule} disabled={isScheduleSaving} className="text-sm bg-white border border-green-600 text-green-700 hover:bg-green-50 px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2">
                               {isScheduleSaving ? '...' : <><CalendarDays className="w-4 h-4"/> Сохранить расписание</>}
                            </button>
                         </div>
                         <div className="space-y-2">
                           <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-3 pb-1 border-b border-gray-100">
                             <div className="col-span-4">День недели</div>
                             <div className="col-span-3 text-center">Статус</div>
                             <div className="col-span-5 flex justify-between pr-2"><span>Открытие</span><span>Закрытие</span></div>
                           </div>
                           
                           {fieldSchedules.map((row, i) => (
                             <div key={i} className={`grid grid-cols-12 gap-4 items-center p-3 rounded-xl border transition-colors ${row.isClosed ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 shadow-sm'}`}>
                               <div className="col-span-4 font-bold text-gray-900 text-sm">
                                 {DAYS_MAP[row.dayOfWeek]}
                               </div>
                               <div className="col-span-3 flex justify-center">
                                 <button onClick={() => scheduleChange(i, 'isClosed', !row.isClosed)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${row.isClosed ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                                    {row.isClosed ? 'Выходной' : 'Рабочий'}
                                 </button>
                               </div>
                               <div className="col-span-5 flex items-center justify-between gap-2">
                                 <input type="time" value={row.openTime} disabled={row.isClosed} onChange={e => scheduleChange(i, 'openTime', e.target.value)} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
                                 <span className="text-gray-400 font-bold">-</span>
                                 <input type="time" value={row.closeTime} disabled={row.isClosed} onChange={e => scheduleChange(i, 'closeTime', e.target.value)} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50" />
                               </div>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 font-medium text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Plus className="w-8 h-8 text-gray-300" /></div>
                      Выберите поле слева или<br/>создайте новое для настройки.
                   </div>
                 )}
              </div>
           </div>
         )}

         {/* --- TAB: BLACKOUTS --- */}
         {activeTab === 'BLACKOUTS' && (
           <div className="flex flex-col lg:flex-row gap-6 h-auto min-h-[600px] items-stretch">
              
              {/* Fields List Sidebar */}
              <div className="w-full lg:w-80 flex-shrink-0 flex flex-col bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden h-max sticky top-6">
                 <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
                    <h3 className="font-bold text-gray-900">Выберите поле для блокировки</h3>
                 </div>
                 <div className="overflow-y-auto max-h-[500px] p-2 space-y-1">
                    {venue.fields?.map((f: any) => (
                      <button 
                         key={f.id} onClick={() => selectField(f)}
                         className={`w-full text-left p-3 rounded-xl transition-all border ${
                           selectedFieldId === f.id 
                           ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm'
                           : 'border-transparent text-gray-700 hover:bg-gray-50'
                         }`}
                      >
                         <div className="font-bold text-sm mb-0.5">{f.name}</div>
                         <div className="text-xs opacity-70">Блокировок: ...</div>
                      </button>
                    ))}
                    {venue.fields?.length === 0 && <div className="p-4 text-center text-sm text-gray-500">У вас нет полей</div>}
                 </div>
              </div>

              {/* Blackouts Panel */}
              <div className="flex-1 bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-6 overflow-hidden flex flex-col items-stretch">
                 {selectedFieldId && selectedFieldId !== 'NEW' ? (
                   <div>
                     <h2 className="text-xl font-bold text-gray-900 mb-6">Блокировки времени</h2>
                     
                     {/* Add Form */}
                     <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 mb-8 shadow-sm">
                        <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2"><CalendarDays className="w-4 h-4"/> Создать новую блокировку</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                           <div>
                              <label className="block text-xs font-bold text-amber-800 uppercase mb-1.5 ml-1 tracking-wider">Начало перекрытия</label>
                              <div className="flex gap-2">
                                <input type="date" value={newBlackout.startDate} onChange={e => setNewBlackout({...newBlackout, startDate: e.target.value})} className="flex-1 px-3 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 text-sm font-medium" />
                                <input type="time" value={newBlackout.startTime} onChange={e => setNewBlackout({...newBlackout, startTime: e.target.value})} className="w-24 px-2 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 text-sm font-medium" />
                              </div>
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-amber-800 uppercase mb-1.5 ml-1 tracking-wider">Окончание перекрытия</label>
                              <div className="flex gap-2">
                                <input type="date" value={newBlackout.endDate} onChange={e => setNewBlackout({...newBlackout, endDate: e.target.value})} className="flex-1 px-3 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 text-sm font-medium" />
                                <input type="time" value={newBlackout.endTime} onChange={e => setNewBlackout({...newBlackout, endTime: e.target.value})} className="w-24 px-2 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 text-sm font-medium" />
                              </div>
                           </div>
                        </div>
                        <div className="mb-4">
                           <label className="block text-xs font-bold text-amber-800 uppercase mb-1.5 ml-1 tracking-wider">Причина (опционально)</label>
                           <input type="text" placeholder="Уборка снега, ремонт ворот и т.д." value={newBlackout.reason} onChange={e => setNewBlackout({...newBlackout, reason: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
                        </div>
                        <button onClick={handleCreateBlackout} disabled={isBlackoutSaving} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-amber-600/20 disabled:opacity-50">
                          {isBlackoutSaving ? 'Добавляем...' : 'Заблокировать слоты'}
                        </button>
                     </div>

                     {/* List of existing */}
                     <h3 className="font-bold text-gray-900 mb-4">Активные блокировки</h3>
                     {isBlackoutsLoading ? (
                       <div className="py-8 text-center text-gray-500 animate-pulse text-sm">Загрузка...</div>
                     ) : fieldBlackouts?.length === 0 ? (
                       <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500 text-sm font-medium">Нет активных блокировок. Поле работает по расписанию.</div>
                     ) : (
                       <div className="space-y-3">
                         {fieldBlackouts?.map((b: any) => (
                           <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                             <div className="mb-3 sm:mb-0">
                               <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-orange-500" />
                                  {new Date(b.startAt).toLocaleString('ru-RU')} - {new Date(b.endAt).toLocaleTimeString('ru-RU')}
                                  {new Date(b.endAt).getDate() !== new Date(b.startAt).getDate() && ` (${new Date(b.endAt).toLocaleDateString('ru-RU')})`}
                               </div>
                               <div className="text-xs text-gray-500 mt-1 italic pl-6">{b.reason || 'Причина не указана'}</div>
                             </div>
                             <button onClick={() => handleDeleteBlackout(b.id)} className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100">
                               <Trash2 className="w-3.5 h-3.5" /> Удалить
                             </button>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-gray-400 font-medium text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><CalendarDays className="w-8 h-8 text-gray-300" /></div>
                      Выберите поле слева,<br/>чтобы настроить блокировки.
                   </div>
                 )}
              </div>
           </div>
         )}
         
      </div>
    </div>
  );
}
