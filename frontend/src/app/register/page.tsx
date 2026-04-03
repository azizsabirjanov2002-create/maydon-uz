'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, User, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/profile';
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    password: '',
    role: 'USER'
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.password) {
       toast.warning('Пожалуйста, заполните все поля');
       return;
    }

    // Very basic phone parsing/formatting logic for +998XXXXXXXXX
    let phoneStr = formData.phone.replace(/\D/g, '');
    if (phoneStr.length === 9) phoneStr = '998' + phoneStr;
    if (phoneStr.length !== 12 || !phoneStr.startsWith('998')) {
       toast.warning('Введите корректный номер телефона (например, 901234567)');
       return;
    }
    const formattedPhone = '+' + phoneStr;

    if (formData.password.length < 8) {
       toast.warning('Пароль должен содержать минимум 8 символов');
       return;
    }

    setLoading(true);

    try {
      // Create user
      const res = await api.post('/auth/register', {
        fullName: formData.fullName,
        phone: formattedPhone,
        password: formData.password,
        role: formData.role
      });

      // Save tokens
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);

      toast.success('Аккаунт создан! Подтвердите номер.');

      // Successfully registered, must verify phone!
      router.push(`/auth/verify?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message;
      if (err.response?.status === 409) {
         toast.error('Пользователь с таким номером уже существует. Войдите в аккаунт.');
      } else {
         toast.error(msg || 'Произошла ошибка при регистрации. Попробуйте еще раз.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col relative overflow-hidden">
      {/* Back Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-20">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-gray-500 hover:text-green-600 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </button>
      </header>

      {/* Decorative Background */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-[600px] h-[600px] bg-green-400/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-emerald-400/10 rounded-full mix-blend-multiply filter blur-3xl" />

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 z-10 w-full">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-green-900/5 border border-white p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-green-500/30">
              <User className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Создать аккаунт</h1>
            <p className="text-gray-500 text-sm">Присоединяйтесь к Maydon.uz для бронирования полей</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'USER' })}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${formData.role === 'USER' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Игрок
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'OWNER' })}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${formData.role === 'OWNER' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Владелец площадки
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Имя и Фамилия</label>
              <input 
                type="text" 
                placeholder="Анвар Набиев"
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all outline-none font-medium text-gray-800 placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Телефон</label>
              <div className="relative">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+998</div>
                 <input 
                   type="tel" 
                   placeholder="90 123 45 67" 
                   value={formData.phone}
                   onChange={e => setFormData({ ...formData, phone: e.target.value })}
                   className="w-full pl-16 pr-5 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all outline-none font-medium text-gray-800 placeholder-gray-400"
                 />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Пароль</label>
              <input 
                type="password" 
                placeholder="Минимум 8 символов" 
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all outline-none font-medium text-gray-800 placeholder-gray-400"
              />
            </div>

            <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold flex items-center justify-center py-4 rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-600/30 mt-6 group disabled:opacity-70">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Зарегистрироваться</span>}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            Уже есть аккаунт?{' '}
            <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-green-600 font-semibold hover:text-green-700 hover:underline">
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
