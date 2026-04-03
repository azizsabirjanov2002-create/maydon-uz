'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/profile';
  
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-advance
    if (value && index < 3) {
      const nextInput = document.getElementById(`code-${index + 1}`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code.join('');
    if (finalCode.length < 4) {
      toast.warning('Введите 4-значный код (используйте 0000 для теста)');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/verify-phone', { code: finalCode });
      setSuccess(true);
      // Wait a moment so user can see the success state
      setTimeout(() => {
        router.push(callbackUrl);
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message;
      toast.error(msg || 'Неверный код. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/4 w-[600px] h-[600px] bg-green-400/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-emerald-400/10 rounded-full mix-blend-multiply filter blur-3xl" />

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 z-10 w-full">
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-green-900/5 border border-white p-8">
          <button onClick={() => router.push('/login')} className="inline-flex items-center gap-2 text-gray-400 hover:text-green-600 transition-colors font-medium text-sm mb-6">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center mx-auto mb-4 border border-green-200">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Подтверждение</h1>
            <p className="text-gray-500 text-sm">Введите код из SMS (используйте 0000 для теста)</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  id={`code-${i}`}
                  type="text"
                  maxLength={1}
                  placeholder="0"
                  value={code[i]}
                  onChange={(e) => handleInputChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={loading || success}
                  className="w-14 h-16 text-center text-2xl font-bold bg-gray-50 rounded-2xl border border-gray-200 focus:ring-4 focus:ring-green-100 focus:border-green-400 transition-all outline-none text-gray-800 disabled:opacity-50"
                />
              ))}
            </div>

            <button disabled={loading || success || code.join('').length < 4} type="submit" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold flex items-center justify-center py-4 rounded-2xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-600/30 group disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Подтвердить</span>}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            Не пришел код?{' '}
            <button type="button" disabled={loading} className="text-green-600 font-semibold hover:text-green-700 hover:underline disabled:text-gray-400">
              Отправить снова
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
