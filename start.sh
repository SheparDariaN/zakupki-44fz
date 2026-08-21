#!/bin/bash
echo "Установка зависимостей..."
npm install
echo "Сборка проекта..."
npm run build
echo "Запуск сервера (production)..."
NODE_ENV=production npm start
