"""Generate standard PWA icons from logo-session-master.png"""
import os
import sys
from PIL import Image

def generate_icons():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_logo = os.path.join(base_dir, 'frontend', 'public', 'images', 'logo-session-master.png')
    out_dir = os.path.join(base_dir, 'frontend', 'public', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    
    if not os.path.exists(src_logo):
        print(f"Source logo not found at: {src_logo}")
        return False
        
    img = Image.open(src_logo).convert("RGBA")
    
    # Standard PWA icon sizes
    sizes = [
        ('icon-192x192.png', (192, 192)),
        ('icon-512x512.png', (512, 512)),
        ('apple-touch-icon.png', (180, 180)),
        ('icon-maskable-512x512.png', (512, 512)),
        ('favicon-32x32.png', (32, 32)),
        ('favicon-16x16.png', (16, 16)),
    ]
    
    for filename, size in sizes:
        target_path = os.path.join(out_dir, filename)
        resized = img.resize(size, Image.Resampling.LANCZOS)
        resized.save(target_path, format="PNG", optimize=True)
        print(f"Generated: {filename} ({size[0]}x{size[1]})")
        
    # Also save apple-touch-icon and favicon in public root for standard browser discovery
    pub_dir = os.path.join(base_dir, 'frontend', 'public')
    img.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(pub_dir, 'apple-touch-icon.png'), format="PNG")
    img.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(pub_dir, 'favicon.png'), format="PNG")
    print("Saved root fallbacks (apple-touch-icon.png, favicon.png)")
    return True

if __name__ == '__main__':
    success = generate_icons()
    if success:
        print("All PWA icons generated successfully!")
    else:
        sys.exit(1)
