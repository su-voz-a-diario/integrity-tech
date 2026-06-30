import sys
from PIL import Image

def remove_background(input_path, output_path, bg_color, tolerance=30):
    im = Image.open(input_path).convert("RGBA")
    data = im.getdata()
    
    new_data = []
    r_bg, g_bg, b_bg = bg_color
    
    for item in data:
        r, g, b, a = item
        # Calculate Euclidean distance to background color
        dist = ((r - r_bg) ** 2 + (g - g_bg) ** 2 + (b - b_bg) ** 2) ** 0.5
        if dist <= tolerance:
            new_data.append((0, 0, 0, 0)) # Make pixel transparent
        else:
            new_data.append((r, g, b, a))
            
    im.putdata(new_data)
    
    # Crop the image to bounding box of non-transparent pixels
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
        
    im.save(output_path, "PNG")
    print(f"Processed {input_path} -> {output_path} (Cropped to {im.size})")

if __name__ == "__main__":
    # Process Logo 1 (bg color is (11, 17, 28))
    remove_background(
        "integrity-tech-frontend/public/integrity-logo.png",
        "integrity-tech-frontend/public/integrity-logo-clean.png",
        (11, 17, 28),
        tolerance=25
    )
    # Process Logo 2 (bg color is (14, 16, 23))
    remove_background(
        "integrity-tech-frontend/public/integrity-logo-2.png",
        "integrity-tech-frontend/public/integrity-logo-2-clean.png",
        (14, 16, 23),
        tolerance=25
    )
