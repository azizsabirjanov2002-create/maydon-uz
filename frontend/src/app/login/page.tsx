'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, User, Building, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/profile';

  const [role, setRole] = useState<'USER' | 'OWNER' | 'ADMIN'>('USER');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
       toast.warning('Пожалуйста, укажите телефон и пароль');
       return;
    }

    let phoneStr = phone.replace(/\D/g, '');
    if (phoneStr.length === 9) phoneStr = '998' + phoneStr;
    if (phoneStr.length !== 12 || !phoneStr.startsWith('998')) {
       toast.warning('Введите корректный номер телефона (напр. 901234567)');
       return;
    }
    const formattedPhone = '+' + phoneStr;

    setLoading(true);

    try {
      let endpoint = '/auth/login';
      if (role === 'OWNER') endpoint = '/auth/owner/login';
      if (role === 'ADMIN') endpoint = '/auth/admin/login';

      const res = await api.post(endpoint, {
        phone: formattedPhone,
        password: password
      });

      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);

      toast.success('Вы успешно вошли в систему');

      // On successful Auth login, redirect!
      if (role === 'OWNER') {
        router.push('/owner/dashboard');
      } else if (role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push(callbackUrl);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
         toast.error('Неверный номер телефона или пароль');
      } else {
         toast.error('Произошла ошибка при входе. Попробуйте снова.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col relative overflow-hidden">
      {/* Back to Home Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-20">
        <button onClick={() => router.push(callbackUrl === '/profile' ? '/' : callbackUrl)} className="inline-flex items-center gap-2 text-gray-500 hover:text-green-600 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </button>
      </header>

      {/* Decorative Background */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-[600px] h-[600px] bg-green-400/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-emerald-400/10 rounded-full mix-blend-multiply filter blur-3xl" />

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-green-900/5 border border-white p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-green-500/30">
              M
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Вход в систему</h1>
            <p className="text-gray-500 text-sm">Выберите вашу роль для входа в кабинет</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-xl mb-6">
              <button type="button" onClick={() => setRole('USER')} className={`flex items-center justify-center gap-2 py-2 px-1 rounded-lg text-xs font-medium transition-all ${role === 'USER' ? 'bg-white shadow-sm text-green-700 border border-green-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                <User className="w-3.5 h-3.5" /> Игрок
              </button>
              <button type="button" onClick={() => setRole('OWNER')} className={`flex items-center justify-center gap-2 py-2 px-1 rounded-lg text-xs font-medium transition-all ${role === 'OWNER' ? 'bg-white shadow-sm text-green-700 border border-green-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                <Building className="w-3.5 h-3.5" /> Владелец
              </button>
              <button type="button" onClick={() => setRole('ADMIN')} className={`flex items-center justify-center gap-2 py-2 px-1 rounded-lg text-xs font-medium transition-all ${role === 'ADMIN' ? 'bg-white shadow-sm text-green-700 border border-green-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                <ShieldCheck className="w-3.5 h-3.5" /> Админ
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Телефон</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+998</div>
                  <input 
                    type="tel" 
                    placeholder="90 123 45 67"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full pl-16 pr-5 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all outline-none font-medium text-gray-800 placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Пароль</label>
                <input 
                  type="password" 
                  placeholder="Введите пароль"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all outline-none font-medium text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold flex items-center justify-center py-4 rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-600/30 mt-6 group disabled:opacity-70">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Войти</span>}
            </button>
          </form>

          {role !== 'ADMIN' && (
            <div className="mt-8 text-center text-sm text-gray-500">
              Нет аккаунта?{' '}
              <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-green-600 font-semibold hover:text-green-700 hover:underline">
                Зарегистрироваться
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
