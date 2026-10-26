Camera Roll is generated from every image in `../assets/`, including subfolders.
The extra story photo remains controlled by the existing conversation.

After adding or replacing artwork, run from the repository root:

```sh
python3 YenHoiMaNuCuocHenTranThe/tools/build-photo-library.py
```

The generator requires Python with Pillow and the `rsvg-convert` executable for
SVG previews. The website itself only needs a static server.

`library.json` maps the original files to 180px thumbnails and previews no larger
than 1600px. Output lives outside `assets/` so rebuilding never imports its own
generated pictures. The browser loads this library only when Photos opens.
