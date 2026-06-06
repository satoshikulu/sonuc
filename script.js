/* global pdfjsLib, PDF_BASE64 */

const PDF_PATH = 'MUHAMMEDASLANPDF.pdf';

const state = {
  pdfDoc: null,
  pdfBlob: null,
  currentPage: 1,
  totalPages: 0,
};

const els = {
  fileInput: null,
  dropZone: null,
  uploadBtn: null,
  track: null,
  canvases: [],
  prevBtn: null,
  nextBtn: null,
  dotsContainer: null,
  externalLink: null,
  carouselSection: null,
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  els.fileInput = document.getElementById('pdf-input');
  els.dropZone = document.getElementById('verify-dropzone');
  els.uploadBtn = document.getElementById('upload-btn');
  els.track = document.getElementById('pdf-track');
  els.prevBtn = document.querySelector('.carousel-prev');
  els.nextBtn = document.querySelector('.carousel-next');
  els.dotsContainer = document.querySelector('.carousel-dots');
  els.externalLink = document.querySelector('.external-link');
  els.carouselSection = document.querySelector('.carousel-section');

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

  bindEvents();
  setCarouselEnabled(false);

  const loaded = await loadDefaultPdf();
  if (loaded) {
    setCarouselEnabled(true);
    els.externalLink.classList.add('active');
  }
}

function bindEvents() {
  els.uploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    els.fileInput.click();
  });

  els.dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#upload-btn')) return;
    els.fileInput.click();
  });

  els.fileInput.addEventListener('change', handleFileSelect);

  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag-over');
  });

  els.dropZone.addEventListener('dragleave', () => {
    els.dropZone.classList.remove('drag-over');
  });

  els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadPdfFile(file);
  });

  els.prevBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
  els.nextBtn.addEventListener('click', () => goToPage(state.currentPage + 1));

  els.externalLink.addEventListener('click', (e) => {
    e.preventDefault();
    openPdfInNewTab();
  });

  let touchStartX = 0;
  els.carouselSection.addEventListener('touchstart', (e) => {
    if (!state.pdfDoc) return;
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  els.carouselSection.addEventListener('touchend', (e) => {
    if (!state.pdfDoc) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) < 50) return;
    if (diff < 0) goToPage(state.currentPage + 1);
    else goToPage(state.currentPage - 1);
  }, { passive: true });

  window.addEventListener('resize', debounce(() => {
    if (state.pdfDoc) renderAllPages();
  }, 200));
}

async function loadDefaultPdf() {
  // Prod (http/https): PDF dosyasini dogrudan yukle
  try {
    const response = await fetch(encodeURI(PDF_PATH));
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      state.pdfBlob = new Blob([buffer], { type: 'application/pdf' });
      await loadPdfBuffer(buffer);
      return true;
    }
  } catch (_) { /* file:// veya ag hatasi */ }

  // Yerel acilis (file://): gomulu base64 yedek
  if (typeof PDF_BASE64 === 'string' && PDF_BASE64.length > 0) {
    const buffer = base64ToBuffer(PDF_BASE64);
    state.pdfBlob = new Blob([buffer], { type: 'application/pdf' });
    await loadPdfBuffer(buffer);
    return true;
  }

  return false;
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) loadPdfFile(file);
}

async function loadPdfFile(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return;
  const buffer = await file.arrayBuffer();
  state.pdfBlob = new Blob([buffer], { type: 'application/pdf' });
  await loadPdfBuffer(buffer);
  setCarouselEnabled(true);
  els.externalLink.classList.add('active');
}

async function loadPdfBuffer(buffer) {
  state.pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
  state.totalPages = state.pdfDoc.numPages;
  state.currentPage = 1;
  setupSlides(state.totalPages);
  buildDots();
  await renderAllPages();
  goToPage(1);
}

function setupSlides(pageCount) {
  els.track.innerHTML = '';
  els.canvases = [];

  for (let i = 1; i <= pageCount; i++) {
    const slide = document.createElement('div');
    slide.className = 'pdf-page-slide' + (i === 1 ? ' pdf-page-active' : ' pdf-page-peek');
    slide.dataset.page = String(i);

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-canvas';
    canvas.id = `pdf-canvas-${i}`;
    slide.appendChild(canvas);

    els.track.appendChild(slide);
    els.canvases.push(canvas);
  }

  els.track.dataset.active = '1';
}

async function renderAllPages() {
  const container = document.querySelector('.certificate-preview');
  const maxWidth = container.clientWidth - 48;
  const outputScale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);

  for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
    const canvas = els.canvases[pageNum - 1];
    if (!canvas) continue;

    const page = await state.pdfDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const displayScale = maxWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: displayScale });

    const displayWidth = Math.floor(viewport.width);
    const displayHeight = Math.floor(viewport.height);

    canvas.width = Math.floor(displayWidth * outputScale);
    canvas.height = Math.floor(displayHeight * outputScale);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    const transform = outputScale !== 1
      ? [outputScale, 0, 0, outputScale, 0, 0]
      : null;

    await page.render({
      canvasContext: ctx,
      viewport,
      transform,
    }).promise;
  }
}

function goToPage(pageNum) {
  if (!state.pdfDoc) return;
  if (pageNum < 1 || pageNum > state.totalPages) return;

  state.currentPage = pageNum;
  els.track.dataset.active = String(pageNum);
  updateCarouselUI();
}

function buildDots() {
  els.dotsContainer.innerHTML = '';
  for (let i = 1; i <= state.totalPages; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot' + (i === 1 ? ' active' : '');
    dot.setAttribute('aria-label', `Seite ${i}`);
    dot.addEventListener('click', () => goToPage(i));
    els.dotsContainer.appendChild(dot);
  }
}

function updateCarouselUI() {
  const dots = els.dotsContainer.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === state.currentPage);
  });

  els.prevBtn.disabled = state.currentPage <= 1;
  els.nextBtn.disabled = state.currentPage >= state.totalPages;

  els.nextBtn.classList.toggle(
    'carousel-next-active',
    state.currentPage < state.totalPages
  );

  els.canvases.forEach((canvas, i) => {
    const slide = canvas.closest('.pdf-page-slide');
    const pageNum = i + 1;
    slide.classList.toggle('pdf-page-active', pageNum === state.currentPage);
    slide.classList.toggle('pdf-page-peek', pageNum !== state.currentPage);
  });
}

function openPdfInNewTab() {
  if (!state.pdfBlob) return;
  window.open(URL.createObjectURL(state.pdfBlob), '_blank');
}

function setCarouselEnabled(enabled) {
  els.carouselSection.classList.toggle('carousel-active', enabled);
  if (!enabled) {
    els.prevBtn.disabled = true;
    els.nextBtn.disabled = true;
  }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
