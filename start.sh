#!/bin/bash

echo "🚀 Starting HotelOpX Frontend..."

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

# Start dev server
npm run dev
