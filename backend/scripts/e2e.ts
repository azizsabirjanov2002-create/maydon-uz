import { PrismaClient } from '@prisma/client';
import assert from 'assert';

const API_URL = 'http://localhost:3000/api/v1';
const prisma = new PrismaClient();

async function request(method: string, path: string, body?: any, token?: string) {
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  return { status: res.status, data };
}

async function runE2E() {
  console.log('🚀 ПРОГОН E2E ТЕСТОВ (MAYDON.UZ PHASE 1)\n');
  
  // Обеспечиваем чистоту состояния первой площадки
  await prisma.venue.update({ where: { id: 1 }, data: { status: 'APPROVED', isActive: true, address: 'Оригинальный адрес Экопарка' } });
  await prisma.booking.deleteMany(); // очищаем брони для чистоты GiST-теста

  // Уникальный телефон для изолированного теста
  const randomPhone = `+998${Math.floor(100000000 + Math.random() * 900000000)}`;
  const password = 'User1234!';
  let userToken = '';

  // ============================================
  // 1. АВТОРИЗАЦИЯ И АНТИФЕЙК (Пользователь)
  // ============================================
  console.log(`1️⃣ Регистрация User'а: ${randomPhone}`);
  const regRes = await request('POST', '/auth/register', {
    phone: randomPhone,
    password,
    fullName: 'Test User',
    role: 'USER',
  });
  assert.strictEqual(regRes.status, 201, `Ожидался статус 201: ${JSON.stringify(regRes.data)}`);
  
  const loginRes = await request('POST', '/auth/login', { phone: randomPhone, password });
  userToken = loginRes.data.accessToken;
  assert.ok(userToken, 'Не получен токен пользователя');

  console.log('2️⃣ Попытка забронировать неверифицированным телефоном (Ожидаем 403)');
  // Используем демо-поле (id=1 из seed), сегодня
  const today = new Date().toISOString().split('T')[0];
  const failBook = await request('POST', '/bookings', {
    fieldId: 1,
    date: today,
    startTime: '10:00',
    durationMinutes: 60,
  }, userToken);
  assert.strictEqual(failBook.status, 403, `Ожидался статус 403. Получен ${failBook.status}`);

  console.log('3️⃣ Успешная верификация телефона через Dev Mock (0000)');
  const verifyRes = await request('POST', '/auth/verify-phone', { code: '0000' }, userToken);
  assert.strictEqual(verifyRes.status, 200, `Верификация не удалась: ${JSON.stringify(verifyRes.data)}`);

  // ============================================
  // 2. АВТО-Ремодерация (Владелец и Админ)
  // ============================================
  console.log('\n4️⃣ Авторизация тестового Владельца');
  const ownerRes = await request('POST', '/auth/owner/login', { phone: '+998901111111', password: 'Demo1234!' });
  const ownerToken = ownerRes.data.accessToken;
  
  console.log('5️⃣ Проверка поиска площадок: Экопарк виден (Спорт 1, Завтра)');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const searchRes1 = await request('GET', `/search?sport_id=1&date=${dateStr}&lat=41.31&lng=69.27&radius=10000`);
  const ecoPark = searchRes1.data.results?.find((r: any) => r.venue.name.includes('Экопарк'));
  assert.ok(ecoPark, `Площадка из seed не найдена в поиске: ${JSON.stringify(searchRes1.data)}`);

  console.log('6️⃣ Owner меняет адрес -> Триггер ре-модерации');
  // Edit venue 1 (Seeded EcoPark)
  const editRes = await request('PUT', '/owner/venues/1', { address: 'Новый тестовый адрес' }, ownerToken);
  console.log('Edit Res:', editRes);
  assert.strictEqual(editRes.data.venue?.status, 'UNDER_REVIEW', 'Статус не сбросился в UNDER_REVIEW');
  assert.strictEqual(editRes.data.venue?.isActive, false, 'isActive не сбросился');
  
  console.log('7️⃣ Проверка поиска: площадка исчезла!');
  const searchRes2 = await request('GET', `/search?sport_id=1&date=${dateStr}&lat=41.31&lng=69.27&radius=10000`);
  const ecoParkHidden = searchRes2.data.results?.find((r: any) => r.venue.name.includes('Экопарк'));
  assert.ok(!ecoParkHidden, 'Площадка все еще видна в поиске после редактирования');

  // Вернем статус админом
  console.log('\n8️⃣ Админ: авторизация и Approve');
  const adminRes = await request('POST', '/auth/admin/login', { phone: '+998901234567', password: 'AdminMaydon2026!' });
  const adminToken = adminRes.data.accessToken;
  // Сначала нужно отправить запрос на модерацию
  await request('POST', '/owner/venues/1/submit', {}, ownerToken);
  // Админ аппрувит
  const dbModReqRes = await request('GET', '/admin/moderation?status=UNDER_REVIEW', null, adminToken);
  const reqForVenue1 = dbModReqRes.data.requests?.find((r: any) => r.venueId === 1);
  assert.ok(reqForVenue1, `Moderation request for Venue 1 not found: ${JSON.stringify(dbModReqRes.data)}`);
  const modReqId = reqForVenue1.id;
  const approveRes = await request('POST', `/admin/moderation/${modReqId}/approve`, {}, adminToken);
  assert.strictEqual(approveRes.status, 200, `Admin Approve Failed: ${JSON.stringify(approveRes.data)}`);

  // ============================================
  // 3. БРОНИ И GIST-ИНДЕКС (Финальная защита от нахлеста)
  // ============================================
  // ============================================

  console.log(`\n9️⃣ Успешная бронь: 10:00 - 11:00 на завтра (${dateStr})`);
  const book1 = await request('POST', '/bookings', {
    fieldId: 1, date: dateStr, startTime: '10:00', durationMinutes: 60
  }, userToken);
  assert.strictEqual(book1.status, 201, `Бронь упала: ${JSON.stringify(book1.data)}`);

  console.log('🔟 Попытка забронировать тот же слот (Полный нахлест) -> Ожидаем 409 Conflict');
  const book2 = await request('POST', '/bookings', {
    fieldId: 1, date: dateStr, startTime: '10:30', durationMinutes: 60
  }, userToken);
  assert.strictEqual(book2.status, 409, `Защита не сработала: ${JSON.stringify(book2.data)}`);

  console.log('1️⃣1️⃣ Попытка забронировать буфер: 11:05 (Буфер поля 15 мин) -> Ожидаем 409 Conflict');
  const book3 = await request('POST', '/bookings', {
    fieldId: 1, date: dateStr, startTime: '11:05', durationMinutes: 60
  }, userToken);
  assert.strictEqual(book3.status, 409, `Защита буфера не сработала: ${JSON.stringify(book3.data)}`);

  console.log('1️⃣2️⃣ Бронь сразу ПОСЛЕ буфера: 11:15 -> Ожидаем 201 Created');
  const book4 = await request('POST', '/bookings', {
    fieldId: 1, date: dateStr, startTime: '11:15', durationMinutes: 60
  }, userToken);
  assert.strictEqual(book4.status, 201, `Справедливая бронь отклонена: ${JSON.stringify(book4.data)}`);

  // ============================================
  // 4. ЛИМИТЫ MAX_ACTIVE_BOOKINGS
  // ============================================
  console.log('\n1️⃣3️⃣ Проверка лимитов: создаем 3-ю бронь в 12:30 -> Ожидаем 201');
  const book5 = await request('POST', '/bookings', {
    fieldId: 1, date: dateStr, startTime: '12:30', durationMinutes: 60
  }, userToken);
  assert.strictEqual(book5.status, 201, `Падение не по плану: ${JSON.stringify(book5.data)}`);

  console.log('1️⃣4️⃣ Попытка 4-й брони (Лимит=3) -> Ожидаем 400 Bad Request');
  const book6 = await request('POST', '/bookings', {
    fieldId: 1, date: dateStr, startTime: '14:00', durationMinutes: 60
  }, userToken);
  assert.strictEqual(book6.status, 400, `Лимит не сработал: ${JSON.stringify(book6.data)}`);
  assert.ok(book6.data.message?.includes('have up to 3 active bookings'), `Текст ошибки лимитов не совпал: ${JSON.stringify(book6.data)}`);

  // ============================================
  // 5. ОТМЕНА БРОНИ И GIST
  // ============================================
  console.log('\n1️⃣5️⃣ Отмена брони 11:15 пользователем');
  const cancelRes = await request('DELETE', `/bookings/${book4.data.booking.id}/cancel`, null, userToken);
  assert.strictEqual(cancelRes.status, 200, `Отмена упала: ${JSON.stringify(cancelRes.data)}`);

  console.log('1️⃣6️⃣ Попытка забронировать отмененный слот 11:15 (GiST Partial Exclusion) -> Ожидаем 201');
  const book7 = await request('POST', '/bookings', {
    fieldId: 1, date: dateStr, startTime: '11:15', durationMinutes: 60
  }, userToken);
  assert.strictEqual(book7.status, 201, `Слот остался заблокированным после отмены: ${JSON.stringify(book7.data)}`);

  console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Архитектура работает надежно и как заявлено. 🎉');
}

runE2E().catch(err => {
  console.error('\n❌ ТЕСТЫ УПАЛИ:');
  console.error(err);
  process.exit(1);
});
