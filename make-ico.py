from PIL import Image

src = r"c:\1. FOR STUDY\8. WEB KNOWLEDGE BASE\apps\web\public\icons\icon-192.png"
out = r"c:\1. FOR STUDY\8. WEB KNOWLEDGE BASE\apps\web\src\app\favicon.ico"

img = Image.open(src).convert("RGBA")
sizes = [(16,16), (32,32), (48,48)]
imgs = [img.resize(s, Image.LANCZOS) for s in sizes]
imgs[0].save(out, format="ICO", sizes=sizes)
print("Done:", out)
