import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

/**
 * Automatically downloads a PDF document directly without showing the browser print screen.
 * Uses html2canvas for high-fidelity rendering + jsPDF for file generation & save.
 */
export async function downloadDocumentPDF(
  element: HTMLElement | null,
  filename = 'document.pdf',
  orientation: 'portrait' | 'landscape' = 'portrait'
) {
  if (!element) {
    throw new Error('Element not provided for PDF export');
  }

  return await generateWithCanvas(element, filename, orientation);
}

/**
 * Explicit browser print dialog method (for when user clicks "Print").
 */
export async function printDocument(
  element: HTMLElement | null,
  filename = 'document.pdf',
  orientation: 'portrait' | 'landscape' = 'portrait'
) {
  if (!element) {
    throw new Error('Element not provided for print');
  }

  const printTarget = element.querySelector('#printable-document') || element;
  const isLandscape = orientation === 'landscape';

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    return await downloadDocumentPDF(element, filename, orientation);
  }

  const styleSheets = Array.from(document.styleSheets);
  let cssText = '';

  for (const sheet of styleSheets) {
    try {
      if (sheet.href) {
        cssText += `<link rel="stylesheet" href="${sheet.href}">`;
      } else if (sheet.cssRules) {
        let rules = '';
        for (const rule of sheet.cssRules) {
          rules += rule.cssText + '\n';
        }
        cssText += `<style>${rules}</style>`;
      }
    } catch (e) {
      if (sheet.href) {
        cssText += `<link rel="stylesheet" href="${sheet.href}">`;
      }
    }
  }

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${filename}</title>
  ${cssText}
  <style>
    @page {
      size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
      margin: 0;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: white;
      -webkit-print-color-adjust: exact !important;
    }
    body {
      display: flex;
      justify-content: center;
      padding: 0;
    }
    #printable-document {
      box-shadow: none !important;
      border: none !important;
      margin: 0 !important;
    }
    @media print {
      html, body {
        width: ${isLandscape ? '297mm' : '210mm'};
        height: auto !important;
      }
      #printable-document {
        width: ${isLandscape ? '297mm' : '210mm'} !important;
        min-height: ${isLandscape ? '210mm' : '297mm'} !important;
        box-shadow: none !important;
        border: none !important;
      }
    }
  </style>
</head>
<body>
  ${printTarget.outerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 1000);
      }, 500);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  return true;
}

/**
 * Direct client-side PDF generation using html2canvas and jsPDF.
 * Pre-converts images to data URLs to completely eliminate CORS taint errors.
 */
async function generateWithCanvas(
  element: HTMLElement,
  filename: string,
  orientation: 'portrait' | 'landscape'
) {
  const isLandscape = orientation === 'landscape';
  const widthMm = isLandscape ? '297mm' : '210mm';
  const heightMm = isLandscape ? '210mm' : '297mm';

  const printTarget = (element.querySelector('#printable-document') || element) as HTMLElement;

  // Off-screen rendering wrapper placed in positive coordinate space behind page
  const wrapper = document.createElement('div');
  wrapper.id = '__pdf_render_sandbox__';
  wrapper.style.cssText = `position:fixed;left:0;top:0;width:${widthMm};min-height:${heightMm};background:white;z-index:-99999;pointer-events:none;overflow:hidden;`;
  document.body.appendChild(wrapper);

  try {
    const clone = printTarget.cloneNode(true) as HTMLElement;
    clone.style.opacity = '1';
    clone.style.visibility = 'visible';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.margin = '0';
    wrapper.appendChild(clone);

    // Wait for document fonts
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }

    // Pre-convert images to Base64 Data URLs so CORS never taints the canvas
    const images = Array.from(wrapper.querySelectorAll('img'));
    await Promise.all(
      images.map(async (img) => {
        try {
          if (!img.src || img.src.startsWith('data:') || img.src.startsWith('blob:')) {
            return;
          }
          img.crossOrigin = 'anonymous';

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);
          const res = await fetch(img.src, { mode: 'cors', signal: controller.signal });
          clearTimeout(timer);

          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => resolve('');
              reader.readAsDataURL(blob);
            });
            if (dataUrl) {
              img.src = dataUrl;
            }
          }
        } catch (err) {
          // If fetch fails (e.g. offline or CORS-restricted), fallback to crossOrigin anonymous
          img.crossOrigin = 'anonymous';
        }
      })
    );

    // Ensure all images are fully loaded before capturing
    await Promise.all(
      images.map(img => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 600);
        });
      })
    );

    // Small delay for DOM layout stabilization
    await new Promise(r => setTimeout(r, 150));

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    // Look for explicit page chunks (e.g. UNAIBillingTemplate pages)
    let pageElements = Array.from(clone.querySelectorAll('[data-pdf-page="true"]')) as HTMLElement[];
    if (pageElements.length === 0 && clone.getAttribute('data-pdf-page') === 'true') {
      pageElements = [clone];
    }
    if (pageElements.length === 0) {
      // Fallback: check if direct children are dedicated full-height pages
      const pageChildren = Array.from(clone.children).filter(
        (c): c is HTMLElement =>
          c.nodeType === Node.ELEMENT_NODE &&
          (c as HTMLElement).tagName === 'DIV' &&
          ((c as HTMLElement).style.pageBreakAfter === 'always' || (c as HTMLElement).className.includes('min-h-['))
      );
      if (pageChildren.length > 0) {
        pageElements = pageChildren;
      }
    }

    if (pageElements.length > 0) {
      // Loop each page element individually for pixel-perfect pagination
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        pageEl.style.margin = '0';
        pageEl.style.boxShadow = 'none';
        pageEl.style.border = 'none';

        const pageCanvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: false, // Must be false to allow canvas.toDataURL()
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          imageTimeout: 3000,
        });

        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(pageCanvas, 'PNG', 0, 0, pdfW, pdfH, undefined, 'FAST');
      }
    } else {
      // Single element without child pages
      clone.style.margin = '0';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.style.width = widthMm;

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 3000,
      });

      const scaledH = (canvas.height * pdfW) / canvas.width;

      if (scaledH <= pdfH + 2) {
        pdf.addImage(canvas, 'PNG', 0, 0, pdfW, Math.min(scaledH, pdfH), undefined, 'FAST');
      } else {
        const pageSliceH = Math.floor((pdfH / pdfW) * canvas.width);
        let y = 0;
        let page = 0;
        while (y < canvas.height) {
          if (page > 0) pdf.addPage();
          const h = Math.min(pageSliceH, canvas.height - y);
          const c = document.createElement('canvas');
          c.width = canvas.width;
          c.height = h;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
            pdf.addImage(c, 'PNG', 0, 0, pdfW, (h * pdfW) / canvas.width, undefined, 'FAST');
          }
          y += pageSliceH;
          page++;
        }
      }
    }

    const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;

  } finally {
    const el = document.getElementById('__pdf_render_sandbox__');
    if (el?.parentNode) el.parentNode.removeChild(el);
  }
}
