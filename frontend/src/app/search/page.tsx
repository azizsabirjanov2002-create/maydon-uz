import { Suspense } from 'react';
import Link from 'next/link';
import { MapPin, Clock, CalendarIcon, ChevronRight } from 'lucide-react';
import { ISearchResponse, ISearchResult } from '@/types/api';
// We use fetch directly for server components as we can get NEXT_PUBLIC_API_URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function getSearchResults(searchParams: { [key: string]: string | string[] | undefined }): Promise<ISearchResponse | null> {
  // Default to Tashkent coordinates if none provided
  const lat = searchParams.lat || '41.2995';
  const lng = searchParams.lng || '69.2401';
  // Check sport, default to 1 (Football)
  const sportId = searchParams.sport_id || '1';
  // Default date to today
  const date = searchParams.date || new Date().toISOString().split('T')[0];
  const radius = searchParams.radius || '5000';
  const sort = searchParams.sort || 'estimated_travel_time';

  try {
    const url = new URL(`${API_URL}/search`);
    url.searchParams.append('lat', lat as string);
    url.searchParams.append('lng', lng as string);
    url.searchParams.append('sport_id', sportId as string);
    url.searchParams.append('date', date as string);
    url.searchParams.append('radius', radius as string);
    url.searchParams.append('sort', sort as string);

    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn("Failed to fetch search results", res.status);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("API error:", error);
    return null;
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const data = await getSearchResults(resolvedParams);
  const paramDate = (resolvedParams.date as string) || new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar Minimal */}
      <header className="sticky top-0 z-50 w-full bg-white shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-xl shadow-md">M</div>
            <span className="font-bold text-xl tracking-tight text-gray-900 hidden md:block">Maydon.uz</span>
          </Link>
          <div className="flex-1 max-w-2xl mx-8 hidden md:flex items-center gap-2">
             <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Ташкент, текущая локация</span>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm">
                <CalendarIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{paramDate}</span>
             </div>
          </div>
          <div>
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-green-600">Войти</Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 flex-1 flex flex-col md:flex-row gap-6">
        
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 p-6 sticky top-24">
            <h2 className="font-bold text-gray-900 mb-6">Фильтры</h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Радиус поиска</label>
                <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400">
                  <option value="5000">до 5 км</option>
                  <option value="10000">до 10 км</option>
                  <option value="15000">до 15 км</option>
                  <option value="20000">до 20 км</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">Если рядом не будет мест, мы автоматически расширим радиус</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Сортировка</label>
                <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-400">
                  <option value="estimated_travel_time">Сначала быстрые маршруты</option>
                  <option value="price_asc">Сначала дешевые</option>
                </select>
              </div>
            </div>
          </div>
        </aside>

        {/* Results Stream */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Площадки <span className="text-gray-400 font-medium text-lg">({data?.totalResults || 0})</span>
            </h1>
          </div>

          {!data || data.results.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Ничего не найдено</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                Попробуйте изменить дату или увеличить радиус поиска. Либо выберите другой вид спорта.
              </p>
            </div>
          ) : (
            data.results.map((result: ISearchResult) => (
              <VenueCard key={result.venue.id} result={result} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function VenueCard({ result }: { result: ISearchResult }) {
  const { venue, distanceKm, estimatedTravelTimeMinutes, fields } = result;
  
  const minPrice = Math.min(...fields.map((f) => f.pricePerHour));
  const totalFields = fields.length;

  // Gather all slots from all fields, sort by time, take first 4 to show "Nearest slots"
  const allSlots = fields.flatMap(f => f.freeSlots || []);
  // In a real app backend gives 'earliestSlot', we just sort uniquely here for UX
  const uniqueNearestSlots = Array.from(new Set(allSlots.map(s => s.startTime))).sort().slice(0, 4);

  return (
    <div className="bg-white rounded-[1.5rem] shadow-sm hover:shadow-lg border border-gray-100 transition-all duration-300 overflow-hidden flex flex-col md:flex-row group">
      {/* Thumbnail */}
      <div className="w-full md:w-64 h-48 md:h-auto bg-gray-100 relative overflow-hidden flex-shrink-0">
        {venue.photos?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.photos[0]} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
           <div className="w-full h-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
             <span className="text-green-300 font-bold text-4xl opacity-50">M</span>
           </div>
        )}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-green-600" /> {estimatedTravelTimeMinutes} мин
        </div>
      </div>

      {/* Content */}
      <div className="p-5 md:p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2">
            <div>
              <h3 className="text-xl font-bold text-gray-900 line-clamp-1 group-hover:text-green-700 transition-colors">{venue.name}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1 line-clamp-1">
                <MapPin className="w-3.5 h-3.5" /> {venue.address} • {distanceKm} км
              </p>
            </div>
            <div className="text-left md:text-right flex-shrink-0 bg-green-50/50 px-3 py-2 rounded-xl border border-green-100/50">
              <div className="text-xs text-gray-500 mb-0.5">Мин. цена</div>
              <div className="font-extrabold text-green-700">{minPrice.toLocaleString('ru-RU')} sum <span className="text-sm font-medium text-gray-500 font-normal">/ час</span></div>
            </div>
          </div>

          {/* Slots Focus */}
          <div className="mt-4 md:mt-6">
            <div className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
               Ближайшие слоты
               <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">{totalFields} {totalFields === 1 ? 'поле' : totalFields < 5 ? 'поля' : 'полей'}</span>
            </div>
            {uniqueNearestSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {uniqueNearestSlots.map((time, i) => (
                  <div key={i} className="bg-green-50/80 text-green-700 border border-green-200/60 font-bold text-sm px-3 py-1.5 rounded-xl hover:bg-green-600 hover:text-white hover:border-green-600 transition-colors cursor-pointer">
                    {time}
                  </div>
                ))}
                {allSlots.length > 4 && (
                  <div className="flex items-center justify-center text-xs font-medium text-gray-400 px-2">
                    и еще {allSlots.length - 4}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-red-500 font-medium bg-red-50 inline-block px-3 py-1 rounded-lg">Нет мест на сегодня</div>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end shrink-0">
          <Link href={`/venue/${venue.id}`} className="w-full md:w-auto bg-gray-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2 shadow-md shadow-gray-200">
            Выбрать поле и время <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
