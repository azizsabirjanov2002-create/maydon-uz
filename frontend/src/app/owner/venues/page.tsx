'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, MapPin, Activity, AlertCircle, Clock, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function OwnerVenuesPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      const res = await api.get('/owner/venues');
      setVenues(res.data.venues || []);
    } catch (err: any) {
      if (err.response?.status !== 401) {
        toast.error('Не удалось загрузить площадки.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Черновик', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
      case 'SUBMITTED':
        return { label: 'Отправлен', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Activity };
      case 'UNDER_REVIEW':
        return { label: 'На ревью', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle };
      case 'APPROVED':
        return { label: 'Одобрен', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 };
      case 'NEEDS_REVISION':
        return { label: 'Требует правок', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertCircle };
      case 'REJECTED':
        return { label: 'Отклонен', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
    }
  };

  const handleCreateDraft = async () => {
     try {
       // Typically creates an empty/draft venue using POST /venues with some mock name
       // Then redirects to edit it. To be implemented properly via a modal or direct route.
       router.push('/owner/venues/create');
     } catch (err) {
       console.error(err);
     }
  };

  return (
    <div className="flex-1 bg-gray-50 p-4 md:p-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Мои площадки</h1>
          <p className="text-gray-500 text-sm mt-1">Управляйте вашими спортивными объектами и статусами модерации</p>
        </div>
        <button onClick={handleCreateDraft} className="bg-gray-900 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-md flex items-center gap-2">
          <Plus className="w-4 h-4" /> Добавить площадку
        </button>
      </div>

      {/* Venues Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm h-48 animate-pulse" />
          ))}
        </div>
      ) : venues.length === 0 ? (
        <div className="bg-white rounded-[1.5rem] p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <MapPin className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">У вас еще нет площадок</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">Создайте первую площадку, добавьте поля и начните принимать бронирования.</p>
          <button onClick={handleCreateDraft} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors inline-block">
            Начать работу
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map((v) => {
            const statusConfig = getStatusConfig(v.status);
            const StatusIcon = statusConfig.icon;
            const isPubliclyVisible = v.status === 'APPROVED' && v.isActive;

            return (
              <div key={v.id} className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                
                {/* Status Bar */}
                <div className={`px-5 py-3 border-b flex justify-between items-center ${isPubliclyVisible ? 'bg-green-50/50 border-green-50' : 'bg-gray-50/50 border-gray-100'}`}>
                   <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
                     <StatusIcon className="w-3.5 h-3.5" />
                     {statusConfig.label}
                   </div>
                   {isPubliclyVisible ? (
                     <span className="text-xs font-medium text-green-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Опубликовано</span>
                   ) : (
                     <span className="text-xs font-medium text-gray-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-400" /> Скрыто из поиска</span>
                   )}
                </div>

                <div className="p-5 flex-1 flex flex-col">
                   <h3 className="text-xl font-bold text-gray-900 line-clamp-1 mb-1">{v.name}</h3>
                   <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-4 line-clamp-1">
                     <MapPin className="w-3.5 h-3.5" /> {v.address}
                   </p>

                   {/* Stats summary */}
                   <div className="grid grid-cols-2 gap-3 mb-6 flex-1">
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Полей в объекте</div>
                        <div className="font-bold text-gray-900">{v._count?.fields || 0}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Район</div>
                        <div className="font-bold text-gray-900 truncate">{v.district || v.city}</div>
                      </div>
                   </div>

                   {/* Under Review Warning */}
                   {v.status === 'UNDER_REVIEW' && (
                     <div className="mb-4 bg-amber-50 text-amber-700 text-xs p-3 rounded-lg flex items-start gap-2 border border-amber-200">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <div>Площадка скрыта из поиска на время прохождения модерации.</div>
                     </div>
                   )}
                   {v.status === 'NEEDS_REVISION' && (
                     <div className="mb-4 bg-orange-50 text-orange-700 text-xs p-3 rounded-lg flex items-start gap-2 border border-orange-200">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <div>Модератор запросил правки. Откройте объект, чтобы увидеть комментарий.</div>
                     </div>
                   )}

                   <div className="pt-2">
                     <Link href={`/owner/venues/${v.id}`} className="w-full justify-center flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5 rounded-xl transition-colors text-sm shadow-md">
                       Управление площадкой <ChevronRight className="w-4 h-4" />
                     </Link>
                   </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
