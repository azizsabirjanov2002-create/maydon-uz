import Link from 'next/link';
import { Search, MapPin, Calendar, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-xl shadow-md">M</div>
            <span className="font-bold text-xl tracking-tight text-gray-900">Maydon.uz</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="/" className="text-green-600 transition-colors">Главная</Link>
            <Link href="/search" className="hover:text-green-600 transition-colors">Площадки</Link>
            <Link href="/about" className="hover:text-green-600 transition-colors">О нас</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-green-600 transition-colors px-3 py-2">Войти</Link>
            <Link href="/register" className="text-sm font-medium bg-green-600 text-white px-5 py-2.5 rounded-full hover:bg-green-700 transition-colors shadow-md shadow-green-600/20">Зарегистрироваться</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-24 pb-32 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-white -z-10" />
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-[500px] h-[500px] bg-green-400/20 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-emerald-400/20 rounded-full mix-blend-multiply filter blur-3xl" />

          <div className="container mx-auto px-4 text-center relative z-10">
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-tight max-w-4xl mx-auto mb-6">
              Играй <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">когда захочешь</span>, <br className="hidden md:block"/> где захочешь.
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
              Удобный и быстрый поиск спортивных площадок по всему Узбекистану. Бронируй футбольные поля, баскетбольные залы и теннисные корты в пару кликов.
            </p>

            {/* Quick Search Card */}
            <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-green-900/5 border border-white p-3 md:p-4">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="flex-1 flex items-center gap-3 w-full px-5 py-4 bg-white/80 rounded-2xl border border-gray-100 hover:border-green-200 focus-within:ring-4 focus-within:ring-green-100 focus-within:border-green-400 transition-all group">
                  <MapPin className="text-gray-400 group-focus-within:text-green-600 w-5 h-5 flex-shrink-0 transition-colors" />
                  <input type="text" placeholder="Город, район или станция метро" className="bg-transparent w-full outline-none text-gray-800 placeholder-gray-400 font-medium" />
                </div>
                <div className="flex-[0.7] flex items-center gap-3 w-full px-5 py-4 bg-white/80 rounded-2xl border border-gray-100 hover:border-green-200 focus-within:ring-4 focus-within:ring-green-100 focus-within:border-green-400 transition-all group">
                  <Calendar className="text-gray-400 group-focus-within:text-green-600 w-5 h-5 flex-shrink-0 transition-colors" />
                  <input type="date" className="bg-transparent w-full outline-none text-gray-800 font-medium cursor-pointer" />
                </div>
                <Link href="/search" className="w-full md:w-auto bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold px-8 py-4 rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-600/30 flex items-center justify-center gap-2 group border border-transparent hover:border-green-500/50">
                  <span>Найти поле</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-24 bg-gray-50/50">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Выберите вид спорта</h2>
              <p className="text-gray-500 font-medium text-lg">У нас есть площадки для любых ваших увлечений</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                { name: 'Футбол', emoji: '⚽', color: 'bg-green-100 text-green-700' },
                { name: 'Баскетбол', emoji: '🏀', color: 'bg-orange-100 text-orange-700' },
                { name: 'Волейбол', emoji: '🏐', color: 'bg-blue-100 text-blue-700' },
                { name: 'Теннис', emoji: '🎾', color: 'bg-lime-100 text-lime-700' },
              ].map((sport) => (
                <Link href={`/search?sport=${sport.name}`} key={sport.name} className="group p-8 rounded-[2rem] border border-gray-100 hover:border-transparent hover:shadow-2xl hover:shadow-gray-200/50 transition-all bg-white text-center flex flex-col items-center justify-center gap-5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className={`w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-sm ${sport.color} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative z-10`}>
                    {sport.emoji}
                  </div>
                  <span className="font-bold text-gray-800 text-lg relative z-10">{sport.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
