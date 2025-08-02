#!/bin/bash

# Setup External Documentation Script for Janus Project
# This script clones/downloads various external documentation resources

set -e  # Exit on error

echo "Setting up external documentation resources..."

# Define base directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLES_DIR="$PROJECT_ROOT/examples"
DOCS_DIR="$PROJECT_ROOT/docs"
LLM_GUIDES_DIR="$DOCS_DIR/llms/guides"

# Function to check if a directory has content
has_content() {
    [ -d "$1" ] && [ "$(ls -A "$1" 2>/dev/null)" ]
}

# Setup examples directory resources
echo "1. Checking examples directory..."
mkdir -p "$EXAMPLES_DIR"
cd "$EXAMPLES_DIR"

# Effect official examples
if ! has_content "effect-official-examples"; then
    echo "   Cloning Effect official examples..."
    TEMP_EFFECT=$(mktemp -d)
    git clone --depth 1 https://github.com/Effect-TS/effect.git "$TEMP_EFFECT/effect"
    if [ -d "$TEMP_EFFECT/effect/examples" ]; then
        cp -r "$TEMP_EFFECT/effect/examples" effect-official-examples
        echo "   Effect official examples copied successfully"
    else
        echo "   Warning: examples directory not found in Effect repository"
    fi
    rm -rf "$TEMP_EFFECT"
else
    echo "   Effect official examples already exist"
fi

# Neo4j documentation
if ! has_content "neo4j-documentation"; then
    echo "   Cloning Neo4j documentation..."
    git clone https://github.com/neo4j/neo4j-documentation.git neo4j-documentation
else
    echo "   Neo4j documentation already exists"
fi

# Vitest documentation (for testing reference)
if ! has_content "vitest"; then
    echo "   Cloning Vitest repository..."
    git clone https://github.com/vitest-dev/vitest.git vitest
else
    echo "   Vitest repository already exists"
fi

# Notion Discord Notifications example
if ! has_content "notion-discord-notifications"; then
    echo "   Cloning Notion Discord Notifications example..."
    git clone https://github.com/bmdavis419/notion-discord-notifications notion-discord-notifications 2>/dev/null || {
    }
else
    echo "   Notion Discord Notifications example already exists"
fi

# Setup Effect documentation and packages
echo "2. Setting up Effect documentation and packages..."
EFFECT_DOCS_DIR="$LLM_GUIDES_DIR/effect-docs"
EFFECT_PACKAGES_DIR="$LLM_GUIDES_DIR/effect-packages"

# Check if we need to fetch/update Effect resources
if ! has_content "$EFFECT_DOCS_DIR" || ! has_content "$EFFECT_PACKAGES_DIR"; then
    echo "   Fetching Effect repository..."
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Clone Effect repository (shallow clone for speed)
    git clone --depth 1 https://github.com/Effect-TS/effect.git effect-temp
    
    # Copy docs if needed
    if ! has_content "$EFFECT_DOCS_DIR"; then
        echo "   Copying Effect documentation..."
        mkdir -p "$EFFECT_DOCS_DIR"
        if [ -d "effect-temp/docs" ]; then
            cp -r effect-temp/docs/* "$EFFECT_DOCS_DIR/"
            echo "   Effect documentation copied successfully"
        else
            echo "   Warning: docs directory not found in Effect repository"
        fi
    else
        echo "   Effect documentation already exists"
    fi
    
    # Copy packages source code if needed
    if ! has_content "$EFFECT_PACKAGES_DIR"; then
        echo "   Copying Effect packages source code..."
        mkdir -p "$EFFECT_PACKAGES_DIR"
        if [ -d "effect-temp/packages" ]; then
            cp -r effect-temp/packages/* "$EFFECT_PACKAGES_DIR/"
            echo "   Effect packages source code copied successfully"
        else
            echo "   Warning: packages directory not found in Effect repository"
        fi
    else
        echo "   Effect packages already exist"
    fi
    
    # Clean up temp directory
    echo "   Cleaning up temporary files..."
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
else
    echo "   Effect documentation and packages already exist"
fi
