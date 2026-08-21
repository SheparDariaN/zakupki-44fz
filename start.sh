#!/bin/bash
echo "Установка зависимостей..."
npm install
echo "Сборка проекта..."
npm run build
echo "Запуск сервера..."
npm start
