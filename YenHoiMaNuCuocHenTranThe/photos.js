/* Photos is an optional side path; it never advances or rewrites the conversation. */
(() => {
  const $ = id => document.getElementById(id);
  const album = $('albumView'), background = $('photosBackground');
  const library = $('photoLibrary'), grid = $('photoGrid'), albums = $('photosAlbums');
  const title = $('photosTitle'), albumsToggle = $('photosAlbumsToggle');
  const status = $('photosStatus'), count = $('photosCount'), secret = $('secretPhoto');
  const viewer = $('viewer'), stage = $('photoStage');
  // Keep the image detached until a real photo URL is available.
  const image = document.createElement('img');
  image.id = 'photoFullImage'; image.alt = ''; image.draggable = false; image.hidden = true;
  const secretImage = $('photoSecret'), loading = $('photoLoading');
  const close = $('photoClose'), infoToggle = $('photoInfoToggle'), details = $('photoDetails');
  const name = $('photoName'), dimensions = $('photoDimensions'), original = $('photoOriginal');
  const previous = $('photoPrev'), next = $('photoNext'), position = $('photoPosition');
  const zoomButton = $('photoZoom'), backdrop = $('photoBackdrop');
  const groups = [
    ['all', 'Camera Roll'], ['event', 'Yến Hội'], ['people', 'Những người đồng hành'],
    ['phone', 'Chiếc điện thoại'], ['marks', 'Dấu ấn'],
  ];
  const secretEntry = {id:'secret', name:'IMG_1026.JPG', secret:true};
  let photos = [], libraryPromise = null, selectedAlbum = 'all', albumsShown = false;
  let currentIndex = 0, returnFocus = null, closing = false, openedSecret = false;
  let zoom = 1, panX = 0, panY = 0;
  const pointers = new Map();
  let gesture = null, multiTouch = false;

  function animate(element, frames, duration) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    return element.animate(frames, {duration, easing:'cubic-bezier(.22,1,.36,1)'}).finished.catch(() => {});
  }
  function entries(group = selectedAlbum) {
    const items = group === 'all' ? photos.slice() : photos.filter(photo => photo.group === group);
    if (group === 'all' && secret.classList.contains('show')) items.push(secretEntry);
    return items;
  }
  function updateCounts() {
    count.textContent = `${entries().length} ảnh`;
    albums.querySelectorAll('[data-album]').forEach(button => {
      button.querySelector('small').textContent = `${entries(button.dataset.album).length} ảnh`;
    });
  }
  function renderAlbums() {
    const fragment = document.createDocumentFragment();
    groups.forEach(([id, label]) => {
      const items = entries(id);
      if (!items.length) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'photos-album'; button.dataset.album = id;
      const cover = document.createElement('span'); cover.className = 'photos-album-cover';
      cover.classList.toggle('is-dark', items[0].transparent && !items[0].light);
      const thumbnail = document.createElement('img');
      thumbnail.src = items[0].thumb; thumbnail.alt = ''; thumbnail.width = thumbnail.height = 180;
      thumbnail.loading = 'lazy'; thumbnail.decoding = 'async'; cover.append(thumbnail);
      const heading = document.createElement('strong'); heading.textContent = label;
      const total = document.createElement('small'); total.textContent = `${items.length} ảnh`;
      button.append(cover, heading, total); fragment.append(button);
    });
    albums.replaceChildren(fragment);
  }
  function renderGrid() {
    const fragment = document.createDocumentFragment();
    entries().filter(photo => !photo.secret).forEach(photo => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'photo'; button.dataset.photoId = photo.id;
      button.classList.toggle('is-dark', photo.transparent && !photo.light);
      button.setAttribute('aria-label', `Mở ${photo.name}`);
      const thumbnail = document.createElement('img');
      thumbnail.src = photo.thumb; thumbnail.alt = ''; thumbnail.width = thumbnail.height = 180;
      thumbnail.loading = 'lazy'; thumbnail.decoding = 'async';
      button.append(thumbnail); fragment.append(button);
    });
    secret.dataset.photoId = 'secret'; secret.hidden = selectedAlbum !== 'all';
    fragment.append(secret); grid.replaceChildren(fragment);
    title.textContent = groups.find(([id]) => id === selectedAlbum)[1];
    library.scrollTop = 0;
    updateCounts();
  }
  async function loadLibrary() {
    if (libraryPromise) return libraryPromise;
    status.hidden = false; status.textContent = 'Đang mở thư viện…';
    libraryPromise = fetch('photos/library.json?v=20261026-1').then(response => {
      if (!response.ok) throw new Error('Photo library unavailable');
      return response.json();
    }).then(items => {
      photos = items;
      renderGrid(); renderAlbums(); status.hidden = true; albumsToggle.disabled = false;
    }).catch(() => {
      libraryPromise = null;
      status.textContent = 'Chưa mở được thư viện ảnh.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Thử lại';
      retry.onclick = loadLibrary; status.append(retry);
    });
    return libraryPromise;
  }
  function showAlbums(show) {
    albumsShown = show;
    library.hidden = show; albums.hidden = !show;
    albumsToggle.textContent = show ? 'Done' : 'Albums';
    title.textContent = show ? 'Albums' : groups.find(([id]) => id === selectedAlbum)[1];
  }
  albumsToggle.onclick = () => showAlbums(!albumsShown);
  albums.onclick = event => {
    const button = event.target.closest('[data-album]');
    if (!button) return;
    selectedAlbum = button.dataset.album; renderGrid(); showAlbums(false);
  };
  album.addEventListener('photos:open', loadLibrary);
  new MutationObserver(updateCounts).observe(secret, {attributes:true, attributeFilter:['class']});

  function setZoom(value, x = 0, y = 0) {
    zoom = Math.max(1, Math.min(4, value));
    const width = stage.clientWidth, height = stage.clientHeight;
    const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
    const fittedWidth = Math.min(width, height * ratio), fittedHeight = Math.min(height, width / ratio);
    const maxX = Math.max(0, (fittedWidth * zoom - width) / 2);
    const maxY = Math.max(0, (fittedHeight * zoom - height) / 2);
    panX = Math.max(-maxX, Math.min(maxX, x)); panY = Math.max(-maxY, Math.min(maxY, y));
    image.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
    stage.classList.toggle('is-zoomed', zoom > 1.01);
    zoomButton.setAttribute('aria-pressed', String(zoom > 1.01));
    zoomButton.setAttribute('aria-label', zoom > 1.01 ? 'Thu nhỏ ảnh' : 'Phóng to ảnh');
    zoomButton.textContent = zoom > 1.01 ? '1×' : '2×';
  }
  function setInfo(show) {
    details.hidden = !show; viewer.classList.toggle('has-info', show);
    infoToggle.setAttribute('aria-expanded', String(show)); setZoom(1);
  }
  function showPhoto(index) {
    const items = entries(), photo = items[index];
    if (!photo) return;
    currentIndex = index; setZoom(1);
    pointers.clear(); gesture = null; multiTouch = false;
    name.textContent = photo.secret ? 'Hôm nay · 23:48' : photo.name;
    image.hidden = true; image.remove(); image.removeAttribute('src');
    secretImage.hidden = !photo.secret; loading.hidden = !!photo.secret;
    loading.textContent = 'Đang mở ảnh…';
    previous.disabled = index === 0; next.disabled = index === items.length - 1;
    position.textContent = `${index + 1} / ${items.length}`;
    zoomButton.disabled = backdrop.disabled = !!photo.secret;
    infoToggle.disabled = false;
    original.hidden = !!photo.secret;
    if (photo.secret) {
      openedSecret = true; setInfo(false); stage.classList.remove('is-light');
      dimensions.textContent = 'IMG_1026.JPG · Hôm nay, 23:48';
      return;
    }
    stage.classList.toggle('is-light', photo.transparent && photo.light);
    dimensions.textContent = `${photo.width} × ${photo.height} · ${photo.name.split('.').pop().toUpperCase()}`;
    original.href = photo.source;
    image.alt = photo.name;
    image.onload = () => {
      if (viewer.hidden || entries()[currentIndex]?.id !== photo.id) return;
      image.hidden = false; loading.hidden = true;
      stage.getAnimations().forEach(animation => animation.cancel());
      animate(stage, [{opacity:.65}, {opacity:1}], 200);
    };
    image.onerror = () => {
      if (viewer.hidden || entries()[currentIndex]?.id !== photo.id) return;
      loading.hidden = false; loading.textContent = 'Chưa mở được ảnh. Cậu có thể thử ảnh gốc trong Info.';
    };
    image.src = photo.preview;
    stage.prepend(image);
  }
  function openPhoto(id, trigger) {
    const index = entries().findIndex(photo => photo.id === id);
    if (index < 0 || closing) return;
    returnFocus = trigger; background.inert = true;
    viewer.hidden = false; viewer.inert = false; viewer.classList.add('show');
    setInfo(false); showPhoto(index); close.focus({preventScroll:true});
    viewer.getAnimations().forEach(animation => animation.cancel());
    animate(viewer, [{opacity:0, transform:'scale(.98)'}, {opacity:1, transform:'scale(1)'}], 250);
  }
  async function closeViewer() {
    if (viewer.hidden || closing) return;
    closing = true; viewer.inert = true;
    viewer.getAnimations().forEach(animation => animation.cancel());
    await animate(viewer, [{opacity:1, transform:'scale(1)'}, {opacity:0, transform:'scale(.98)'}], 150);
    viewer.classList.remove('show'); viewer.hidden = true; background.inert = false;
    image.remove(); image.removeAttribute('src'); image.hidden = true; setZoom(1); pointers.clear(); gesture = null;
    if (openedSecret) {secret.classList.remove('show'); openedSecret = false;}
    closing = false;
    if (album.classList.contains('active') && returnFocus?.isConnected && !returnFocus.hidden) {
      if (returnFocus === secret && !secret.classList.contains('show')) albumsToggle.focus({preventScroll:true});
      else returnFocus.focus({preventScroll:true});
    }
  }
  grid.onclick = event => {
    const button = event.target.closest('[data-photo-id]');
    if (button) openPhoto(button.dataset.photoId, button);
  };
  close.onclick = closeViewer;
  viewer.addEventListener('photos:close', closeViewer);
  previous.onclick = () => showPhoto(currentIndex - 1);
  next.onclick = () => showPhoto(currentIndex + 1);
  zoomButton.onclick = () => setZoom(zoom > 1.01 ? 1 : 2);
  backdrop.onclick = () => stage.classList.toggle('is-light');
  infoToggle.onclick = () => setInfo(details.hidden);
  stage.ondblclick = () => {if (!zoomButton.disabled) zoomButton.click();};
  album.addEventListener('photos:back', event => {
    if (!viewer.hidden) {event.preventDefault(); closeViewer();}
    else if (albumsShown) {event.preventDefault(); showAlbums(false);}
  });
  document.addEventListener('keydown', event => {
    if (!album.classList.contains('active') || $('phone').inert || viewer.hidden || closing) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); showPhoto(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });

  // Gesture state stays inside the photo viewport; the page and chat never move.
  function rebaseGesture() {
    const points = [...pointers.values()];
    if (points.length >= 2) {
      multiTouch = true;
      gesture = {distance:Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        midX:(points[0].x + points[1].x) / 2, midY:(points[0].y + points[1].y) / 2,
        zoom, panX, panY};
    } else if (points.length === 1) gesture = {...points[0], panX, panY};
    else gesture = null;
  }
  stage.addEventListener('pointerdown', event => {
    if (zoomButton.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {x:event.clientX, y:event.clientY}); rebaseGesture();
  });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, {x:event.clientX, y:event.clientY});
    const rect = stage.getBoundingClientRect(), factor = stage.clientWidth / rect.width;
    const points = [...pointers.values()];
    if (points.length >= 2) {
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const ratio = distance / Math.max(1, gesture.distance);
      const midX = (points[0].x + points[1].x) / 2, midY = (points[0].y + points[1].y) / 2;
      const anchorX = (gesture.midX - rect.left - rect.width / 2) * factor;
      const anchorY = (gesture.midY - rect.top - rect.height / 2) * factor;
      setZoom(gesture.zoom * ratio,
        gesture.panX * ratio + anchorX * (1 - ratio) + (midX - gesture.midX) * factor,
        gesture.panY * ratio + anchorY * (1 - ratio) + (midY - gesture.midY) * factor);
    } else if (zoom > 1.01) {
      setZoom(zoom, gesture.panX + (event.clientX - gesture.x) * factor,
        gesture.panY + (event.clientY - gesture.y) * factor);
    }
  });
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const start = gesture;
    const maySwipe = event.type === 'pointerup' && pointers.size === 1 && !multiTouch && zoom <= 1.01;
    pointers.delete(event.pointerId);
    if (maySwipe && start) {
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) showPhoto(currentIndex + (dx < 0 ? 1 : -1));
      else if (dy > 90 && dy > Math.abs(dx) * 1.3) closeViewer();
    }
    if (!pointers.size) multiTouch = false;
    rebaseGesture();
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
})();
