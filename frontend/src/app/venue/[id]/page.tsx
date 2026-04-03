import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Clock, ArrowLeft, Star, ChevronRight, Info } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function getVenueDetails(id: string) {
  try {
    // Assuming backend has a public endpoint to get venue details. 
    // If it fails, we return null and show notFound 
    // For development, we might fail gracefully if backend isn't ready
    const res = await fetch(`${API_URL}/venues/${id}/public`, { next: { revalidate: 30 } });
    if (!res.ok) {
        if(res.status === 404) return null;
        throw new Error("Failed to fetch venue");
    }
    return await res.json();
  } catch (error) {
    console.error("Venue details fetch error:", error);
    // Return mock data for UI visualization if backend is offline
    return {
      id,
      name: "Спортивный комплекс 'Cheesie Arena'",
      address: "Юнусабадский район, ул. Амира Темура",
      city: "Tashkent",
      photos: [],
      description: "Отличный спортивный комплекс с новыми полями и профессиональным освещением.",
      fields: [
        {
          id: 101,
          name: "Поле A (Искусственный газон)",
          pricePerHour: 150000,
          coverageType: "ARTIFICIAL",
          hasLighting: true,
          hasLockerRoom: true,
          hasShower: true,
          hasParking: true,
        },
        {
          id: 102,
          name: "Поле B (Крытое)",
          pricePerHour: 200000,
          coverageType: "PARQUET",
          hasLighting: true,
          hasLockerRoom: true,
          hasShower: false,
          hasParking: true,
        }
      ]
    };
  }
}

export default async function VenuePage({ params }: { params: { id: string } }) {
  const venue = await getVenueDetails(params.id);
  
  if (!venue) {
    notFound();
  }

  // To let user pick a slot, we need a client component for interactive Date & Slot selection
  // But we will structure the layout here

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
       {/* Simple Header */}
      <header className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/search" className="inline-flex items-center gap-2 text-gray-500 hover:text-green-600 transition-colors font-medium text-sm">
            <ArrowLeft className="w-4 h-4" /> В результаты поиска
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8 flex-1">
         {/* Venue Hero */}
         <div className="bg-white rounded-[2rem] p-4 md:p-6 shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-6 md:gap-8 relative overflow-hidden">
             <div className="w-full md:w-1/3 aspect-video md:aspect-square bg-gray-100 rounded-3xl relative overflow-hidden flex-shrink-0">
               {venue.photos?.[0] ? (
                 // eslint-disable-next-line @next/next/no-img-element
                  <img src={venue.photos[0]} alt={venue.name} className="w-full h-full object-cover" />
               ) : (
                  <div className="w-full h-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                    <MapPin className="text-green-300 w-16 h-16 opacity-50" />
                  </div>
               )}
             </div>

             <div className="flex-1 flex flex-col justify-center">
                <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold mb-4 w-max">
                  <Star className="w-3.5 h-3.5 fill-current" /> 4.8 Рейтинг
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight mb-3">
                  {venue.name}
                </h1>
                <p className="text-gray-500 flex items-center gap-2 text-base mb-6">
                  <MapPin className="w-4 h-4" /> {venue.address}, {venue.city}
                </p>

                <div className="bg-gray-50 p-4 rounded-2xl text-sm text-gray-600 leading-relaxed mb-6">
                  {venue.description || "Новая футбольная площадка премиум-класса. Идеально подходит для вечерних игр с друзьями и турниров."}
                </div>
             </div>
         </div>

         {/* Fields Selection & Booking (Client Part) */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
               <h2 className="text-2xl font-bold text-gray-900 border-b pb-4">Доступные поля ({venue.fields.length})</h2>
               
               {venue.fields.map((field: any) => (
                 <div key={field.id} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100 hover:border-green-200 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{field.name}</h3>
                        <div className="text-sm text-gray-500 flex items-center gap-4">
                          <span>Покрытие: <span className="font-medium text-gray-800">{field.coverageType || 'Стандарт'}</span></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Цена за час</div>
                        <div className="text-xl font-extrabold text-green-700">{field.pricePerHour.toLocaleString('ru-RU')} sum</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                       {field.hasLighting && <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">Освещение</span>}
                       {field.hasLockerRoom && <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">Раздевалка</span>}
                       {field.hasShower && <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">Душ</span>}
                       {field.hasParking && <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">Парковка</span>}
                    </div>

                    <div className="border-t pt-4 flex justify-between items-center">
                       <span className="text-sm font-medium text-gray-800">Перейти к расписанию</span>
                       <Link href={`/venue/${venue.id}/book?field=${field.id}`} className="bg-green-50 text-green-700 hover:bg-green-600 hover:text-white font-medium px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2">
                         Выбрать слоты <ChevronRight className="w-4 h-4" />
                       </Link>
                    </div>
                 </div>
               ))}
            </div>

            <div className="lg:col-span-1">
               <div className="bg-gray-900 rounded-[1.5rem] p-6 text-white sticky top-24 shadow-xl">
                  <div className="flex items-center gap-3 mb-6">
                     <Info className="w-6 h-6 text-green-400" />
                     <h3 className="text-lg font-bold">Как бронировать?</h3>
                  </div>
                  <ul className="space-y-4 text-sm text-gray-300">
                     <li className="flex gap-3">
                       <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-400">1</div>
                       <p>Выберите конкретное поле из списка слева.</p>
                     </li>
                     <li className="flex gap-3">
                       <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-400">2</div>
                       <p>Нажмите "Выбрать слоты", чтобы перейти к календарю.</p>
                     </li>
                     <li className="flex gap-3">
                       <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-400">3</div>
                       <p>Отметьте удобное время. Мы покажем честную цену с учетом буферов.</p>
                     </li>
                  </ul>
               </div>
            </div>
         </div>
      </main>
    </div>
  );
}
