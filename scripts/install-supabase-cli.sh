#!/bin/bash

# Script to install Supabase CLI on WSL/Linux

echo "📦 Installing Supabase CLI..."

# Install using npm (works on WSL)
npm install -g supabase

# Verify installation
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI installed successfully!"
    supabase --version
    echo ""
    echo "📝 Next steps:"
    echo "1. supabase link --project-ref YOUR_PROJECT_REF"
    echo "2. supabase db push"
else
    echo "❌ Installation failed. Try manual installation:"
    echo "   npm install -g supabase"
fi
