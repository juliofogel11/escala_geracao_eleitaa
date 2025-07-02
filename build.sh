#!/bin/bash

# Build script for Railway deployment

echo "🚀 Iniciando build do Sistema de Escala Geração Eleita..."

# Install backend dependencies
echo "📦 Instalando dependências do backend..."
cd backend
pip install -r requirements.txt

# Build frontend
echo "📦 Construindo frontend..."
cd ../frontend
yarn install
yarn build

echo "✅ Build concluído com sucesso!"