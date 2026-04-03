# Maydon.uz Backend — Запуск

## Требования
- Node.js 18+ LTS
- PostgreSQL 15+

---

## Шаг 1 — Установить Node.js

Скачать с [nodejs.org](https://nodejs.org/) → выбрать **LTS** версию → установить.

Проверить:
```powershell
node --version   # должно быть v18+
npm --version
```

---

## Шаг 2 — Установить PostgreSQL

Скачать с [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) → установить.

При установке запомни пароль для пользователя `postgres`.

Создать базу данных:
```powershell
# Открыть psql или pgAdmin и выполнить:
CREATE DATABASE maydon_db;
```

Или через командную строку:
```powershell
psql -U postgres -c "CREATE DATABASE maydon_db;"
```

---

## Шаг 3 — Настроить .env

Открыть файл `.env` и заменить `password` на пароль PostgreSQL:
```
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/maydon_db"
```

---

## Шаг 4 — Установить зависимости

```powershell
cd c:\Users\Intel\Desktop\maydon-uz\backend
npm install
```

---

## Шаг 5 — Запустить миграции и seed

```powershell
npm run db:migrate    # создаст все таблицы
npm run db:seed       # заполнит спорт-категории, создаст admin
```

---

## Шаг 6 — Запустить сервер

```powershell
npm run dev
```

Сервер запустится на: **http://localhost:3000**
Swagger docs: **http://localhost:3000/docs**

---

## Быстрые проверки

```powershell
# Health check
curl http://localhost:3000/health

# Список видов спорта
curl http://localhost:3000/api/v1/sports

# Поиск площадок (Ташкент, футбол, завтра)
curl "http://localhost:3000/api/v1/search?sport_id=1&lat=41.2995&lng=69.2401&date=2026-04-04"

# Регистрация пользователя
curl -X POST http://localhost:3000/api/v1/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"fullName\":\"Test User\",\"phone\":\"+998901000001\",\"password\":\"Test1234!\"}"

# Логин как admin
curl -X POST http://localhost:3000/api/v1/auth/admin/login ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"+998901234567\",\"password\":\"AdminMaydon2026!\"}"
```

---

## Структура API (Phase 1)

| Метод | Путь | Доступ |
|---|---|---|
| GET | /health | Public |
| GET | /api/v1/sports | Public |
| POST | /api/v1/auth/register | Public |
| POST | /api/v1/auth/login | Public |
| POST | /api/v1/auth/owner/register | Public |
| POST | /api/v1/auth/owner/login | Public |
| POST | /api/v1/auth/admin/login | Public |
| POST | /api/v1/auth/refresh | Public |
| GET | /api/v1/search | Public |
| GET | /api/v1/search/field/:id/slots | Public |
| GET | /api/v1/venues/:id | Public |
| POST | /api/v1/bookings | User |
| GET | /api/v1/bookings/my | User |
| GET | /api/v1/bookings/:id | User/Owner |
| DELETE | /api/v1/bookings/:id/cancel | User/Owner |
| GET | /api/v1/owner/venues | Owner |
| POST | /api/v1/owner/venues | Owner |
| PUT | /api/v1/owner/venues/:id | Owner |
| POST | /api/v1/owner/venues/:id/submit | Owner |
| POST | /api/v1/owner/venues/:id/fields | Owner |
| GET | /api/v1/owner/fields | Owner |
| PUT | /api/v1/owner/fields/:id | Owner |
| PUT | /api/v1/owner/fields/:id/schedule | Owner |
| POST | /api/v1/owner/fields/:id/blackouts | Owner |
| DELETE | /api/v1/owner/blackouts/:id | Owner |
| GET | /api/v1/owner/bookings | Owner |
| GET | /api/v1/owner/dashboard | Owner |
| PUT | /api/v1/owner/bookings/:id/no-show | Owner |
| PUT | /api/v1/owner/bookings/:id/cancel | Owner |
| GET | /api/v1/owner/fields/:id/slots | Owner |
| GET | /api/v1/admin/moderation | Admin |
| POST | /api/v1/admin/moderation/:id/approve | Admin |
| POST | /api/v1/admin/moderation/:id/reject | Admin |
| POST | /api/v1/admin/moderation/:id/revision | Admin |
| GET | /api/v1/admin/venues | Admin |
| PUT | /api/v1/admin/venues/:id/toggle | Admin |
| GET | /api/v1/admin/bookings | Admin |
| PUT | /api/v1/admin/bookings/:id/cancel | Admin |
| GET | /api/v1/admin/stats | Admin |
| GET | /api/v1/admin/sports | Admin |
| POST | /api/v1/admin/sports | Admin |
