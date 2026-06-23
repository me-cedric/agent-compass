#!/bin/bash

# Checkmarx Package Generator
# Creates ZIP files for each module containing only source code (no dependencies or config files)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📦 Checkmarx Package Generator"
echo "================================"
echo ""

# Function to package a module
package_module() {
    local module_name=$1
    local module_path=$2
    local source_dirs=$3
    local output_file="checkmarx-${module_name}.zip"
    
    echo "📦 Packaging ${module_name}..."
    
    if [ ! -d "$module_path" ]; then
        echo "❌ Error: Module directory not found: $module_path"
        return 1
    fi
    
    cd "$module_path"
    
    # Count source files
    file_count=$(find $source_dirs -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l | xargs)
    
    if [ "$file_count" -eq 0 ]; then
        echo "❌ Error: No source files found in $source_dirs"
        return 1
    fi
    
    # Create ZIP with only source directories
    zip -r "$PROJECT_ROOT/$output_file" $source_dirs \
        -x "*/node_modules/*" \
        -x "*/.turbo/*" \
        -x "*/dist/*" \
        -x "*/build/*" \
        -x "*/coverage/*" \
        -x "*/__tests__/*" \
        -x "*.spec.ts" \
        -x "*.spec.tsx" \
        -x "*.test.ts" \
        -x "*.test.tsx" \
        -x "*.config.ts" \
        -x "*.config.js" \
        -x "*.json" \
        > /dev/null 2>&1
    
    # Get line count
    lines=$(find $source_dirs -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
    
    echo "   ✓ $file_count source files"
    echo "   ✓ ~$lines lines of code"
    echo "   ✓ Created: $output_file"
    echo ""
    
    cd "$PROJECT_ROOT"
}

# Package API
if [ "$1" = "api" ] || [ -z "$1" ]; then
    package_module "api" "$PROJECT_ROOT/apps/api" "src"
fi

# Package Backoffice
if [ "$1" = "backoffice" ] || [ -z "$1" ]; then
    package_module "backoffice" "$PROJECT_ROOT/apps/backoffice" "src"
fi

# Package Mobile
if [ "$1" = "mobile" ] || [ -z "$1" ]; then
    package_module "mobile" "$PROJECT_ROOT/apps/mobile-app" "src app"
fi

echo "================================"
echo "✅ Package generation complete!"
echo ""
echo "Generated files:"
ls -lh checkmarx-*.zip 2>/dev/null || echo "No packages generated"
echo ""
echo "Next steps:"
echo "1. Submit each ZIP file to Checkmarx platform"
echo "2. Configure project settings for each module"
echo "3. Run SAST scan"
echo "4. Review findings in Checkmarx dashboard"
