# PZ Rcon Manager - Frontend

React + TypeScript frontend для PZ Rcon Manager

## Швидкий старт

### Development

```bash
cd frontend
npm install
npm run dev
```

Відкрий http://localhost:3000

### Production Build

```bash
npm run build
npm run preview
```

## Features

### ✅ Реалізовано:

- 🔐 **Авторизація** - простий логін/пароль
- 🖥️ **Управління серверами** - CRUD операції
  - Додавання серверів
  - Редагування
  - Видалення
  - Вибір активного сервера
- 🔌 **RCON підключення** - connect/disconnect
- 💻 **Консоль** - виконання команд через RCON
  - Історія команд
  - Навігація ↑/↓
  - Популярні команди
- 🎨 **Темний UI** - сучасний дизайн з Tailwind CSS

## Структура

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # API клієнт (axios)
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.tsx      # Сторінка логіну
│   │   │   └── ProtectedRoute.tsx
│   │   ├── Console/
│   │   │   └── RconConsole.tsx    # RCON консоль
│   │   ├── Layout/
│   │   │   └── Layout.tsx     # Основний layout
│   │   └── Servers/
│   │       └── ServerList.tsx # Список серверів + форма
│   ├── store/
│   │   ├── authStore.ts       # Zustand auth state
│   │   └── serverStore.ts     # Zustand server state
│   ├── types/
│   │   └── api.ts            # TypeScript типи
│   ├── App.tsx               # Роутинг
│   ├── main.tsx
│   └── index.css
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Технології

- **React 18** + **TypeScript**
- **Vite** - збірка
- **React Router 6** - роутинг
- **Zustand** - state management
- **Axios** - HTTP клієнт
- **Tailwind CSS** - стилі
- **Lucide React** - іконки

## Використання

### 1. Логін
- Будь-який логін/пароль (demo режим)
- Зберігається в localStorage

### 2. Додати сервер
- Перейти на "Сервери"
- "Додати сервер"
- Ввести дані RCON підключення

### 3. Підключитись
- Клікнути "Підключити" на сервері
- Або вибрати сервер і перейти в консоль

### 4. Виконати команду
- Перейти в "Консоль"
- Ввести команду (наприклад: `players`)
- Enter для виконання
- ↑/↓ для навігації по історії

## API Proxy

Frontend проксує `/api/*` на `http://localhost:8000`:

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

## Deployment

### Docker

```bash
# Development
docker-compose up frontend

# Production
docker build -t pz-webadmin-frontend -f frontend/Dockerfile frontend/
docker run -p 80:80 pz-webadmin-frontend
```

### Nginx

Production build використовує Nginx з автоматичним проксі до backend.
