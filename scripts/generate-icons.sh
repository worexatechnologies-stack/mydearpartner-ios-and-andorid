#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")/.."

if [ ! -f "logo.png" ]; then
    echo "❌ Error: logo.png not found in the project root."
    echo "Please save your logo image as 'logo.png' in the MyDearPartner folder and run this script again."
    exit 1
fi

echo "🚀 Generating App Icons for iOS and Android..."

# Android setup
ANDROID_RES_DIR="android/app/src/main/res"

# Android sizes: mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
echo "🎨 Generating Android icons..."
mkdir -p "$ANDROID_RES_DIR/mipmap-mdpi"
mkdir -p "$ANDROID_RES_DIR/mipmap-hdpi"
mkdir -p "$ANDROID_RES_DIR/mipmap-xhdpi"
mkdir -p "$ANDROID_RES_DIR/mipmap-xxhdpi"
mkdir -p "$ANDROID_RES_DIR/mipmap-xxxhdpi"

sips -z 48 48 logo.png --out "$ANDROID_RES_DIR/mipmap-mdpi/ic_launcher.png" > /dev/null
sips -z 48 48 logo.png --out "$ANDROID_RES_DIR/mipmap-mdpi/ic_launcher_round.png" > /dev/null

sips -z 72 72 logo.png --out "$ANDROID_RES_DIR/mipmap-hdpi/ic_launcher.png" > /dev/null
sips -z 72 72 logo.png --out "$ANDROID_RES_DIR/mipmap-hdpi/ic_launcher_round.png" > /dev/null

sips -z 96 96 logo.png --out "$ANDROID_RES_DIR/mipmap-xhdpi/ic_launcher.png" > /dev/null
sips -z 96 96 logo.png --out "$ANDROID_RES_DIR/mipmap-xhdpi/ic_launcher_round.png" > /dev/null

sips -z 144 144 logo.png --out "$ANDROID_RES_DIR/mipmap-xxhdpi/ic_launcher.png" > /dev/null
sips -z 144 144 logo.png --out "$ANDROID_RES_DIR/mipmap-xxhdpi/ic_launcher_round.png" > /dev/null


sips -z 192 192 logo.png --out "$ANDROID_RES_DIR/mipmap-xxxhdpi/ic_launcher.png" > /dev/null
sips -z 192 192 logo.png --out "$ANDROID_RES_DIR/mipmap-xxxhdpi/ic_launcher_round.png" > /dev/null

# iOS setup
IOS_ICONSET_DIR="ios/MyDearPartner/Images.xcassets/AppIcon.appiconset"

echo "🎨 Generating iOS icons..."
mkdir -p "$IOS_ICONSET_DIR"

# Generate iOS sizes
sips -z 40 40 logo.png --out "$IOS_ICONSET_DIR/Icon-20@2x.png" > /dev/null
sips -z 60 60 logo.png --out "$IOS_ICONSET_DIR/Icon-20@3x.png" > /dev/null
sips -z 29 29 logo.png --out "$IOS_ICONSET_DIR/Icon-29.png" > /dev/null
sips -z 58 58 logo.png --out "$IOS_ICONSET_DIR/Icon-29@2x.png" > /dev/null
sips -z 87 87 logo.png --out "$IOS_ICONSET_DIR/Icon-29@3x.png" > /dev/null
sips -z 40 40 logo.png --out "$IOS_ICONSET_DIR/Icon-40.png" > /dev/null
sips -z 80 80 logo.png --out "$IOS_ICONSET_DIR/Icon-40@2x.png" > /dev/null
sips -z 120 120 logo.png --out "$IOS_ICONSET_DIR/Icon-40@3x.png" > /dev/null
sips -z 120 120 logo.png --out "$IOS_ICONSET_DIR/Icon-60@2x.png" > /dev/null
sips -z 180 180 logo.png --out "$IOS_ICONSET_DIR/Icon-60@3x.png" > /dev/null
sips -z 76 76 logo.png --out "$IOS_ICONSET_DIR/Icon-76.png" > /dev/null
sips -z 152 152 logo.png --out "$IOS_ICONSET_DIR/Icon-76@2x.png" > /dev/null
sips -z 167 167 logo.png --out "$IOS_ICONSET_DIR/Icon-83.5@2x.png" > /dev/null
sips -z 1024 1024 logo.png --out "$IOS_ICONSET_DIR/Icon-1024.png" > /dev/null

# Create iOS Contents.json
cat > "$IOS_ICONSET_DIR/Contents.json" << EOF
{
  "images" : [
    { "size" : "20x20", "idiom" : "iphone", "filename" : "Icon-20@2x.png", "scale" : "2x" },
    { "size" : "20x20", "idiom" : "iphone", "filename" : "Icon-20@3x.png", "scale" : "3x" },
    { "size" : "29x29", "idiom" : "iphone", "filename" : "Icon-29.png", "scale" : "1x" },
    { "size" : "29x29", "idiom" : "iphone", "filename" : "Icon-29@2x.png", "scale" : "2x" },
    { "size" : "29x29", "idiom" : "iphone", "filename" : "Icon-29@3x.png", "scale" : "3x" },
    { "size" : "40x40", "idiom" : "iphone", "filename" : "Icon-40@2x.png", "scale" : "2x" },
    { "size" : "40x40", "idiom" : "iphone", "filename" : "Icon-40@3x.png", "scale" : "3x" },
    { "size" : "60x60", "idiom" : "iphone", "filename" : "Icon-60@2x.png", "scale" : "2x" },
    { "size" : "60x60", "idiom" : "iphone", "filename" : "Icon-60@3x.png", "scale" : "3x" },
    { "size" : "20x20", "idiom" : "ipad", "filename" : "Icon-20@2x.png", "scale" : "2x" },
    { "size" : "29x29", "idiom" : "ipad", "filename" : "Icon-29.png", "scale" : "1x" },
    { "size" : "29x29", "idiom" : "ipad", "filename" : "Icon-29@2x.png", "scale" : "2x" },
    { "size" : "40x40", "idiom" : "ipad", "filename" : "Icon-40.png", "scale" : "1x" },
    { "size" : "40x40", "idiom" : "ipad", "filename" : "Icon-40@2x.png", "scale" : "2x" },
    { "size" : "76x76", "idiom" : "ipad", "filename" : "Icon-76.png", "scale" : "1x" },
    { "size" : "76x76", "idiom" : "ipad", "filename" : "Icon-76@2x.png", "scale" : "2x" },
    { "size" : "83.5x83.5", "idiom" : "ipad", "filename" : "Icon-83.5@2x.png", "scale" : "2x" },
    { "size" : "1024x1024", "idiom" : "ios-marketing", "filename" : "Icon-1024.png", "scale" : "1x" }
  ],
  "info" : {
    "version" : 1,
    "author" : "xcode"
  }
}
EOF

echo "✅ All iOS and Android App Icons have been generated successfully!"
echo "Re-build the app to see the new icons!"
