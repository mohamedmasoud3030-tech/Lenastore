import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportElementToPdf(
  elementId: string,
  filename: string = 'document.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('العنصر المراد تصديره إلى PDF غير موجود');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc, clonedElement) => {
      // 1. Sanitize all <style> elements in cloned document to remove/replace oklch
      const styleElements = Array.from(clonedDoc.querySelectorAll('style'));
      styleElements.forEach((style) => {
        if (style.textContent && style.textContent.includes('oklch')) {
          style.textContent = style.textContent.replace(/oklch\([^)]+\)/gi, 'rgb(15 23 42)');
        }
      });

      // 2. Convert computed styles and strip any inline oklch
      const origElements = [element, ...Array.from(element.querySelectorAll('*'))];
      const clonedElements = [clonedElement, ...Array.from(clonedElement.querySelectorAll('*'))];

      clonedElements.forEach((clonedNode, idx) => {
        const htmlCloned = clonedNode as HTMLElement;
        const origNode = origElements[idx] as HTMLElement;

        if (origNode && htmlCloned && htmlCloned.style) {
          try {
            const computed = window.getComputedStyle(origNode);

            if (computed.color && !computed.color.includes('oklch')) {
              htmlCloned.style.color = computed.color;
            }
            if (computed.backgroundColor && !computed.backgroundColor.includes('oklch')) {
              htmlCloned.style.backgroundColor = computed.backgroundColor;
            }
            if (computed.borderColor && !computed.borderColor.includes('oklch')) {
              htmlCloned.style.borderColor = computed.borderColor;
            }
          } catch {
            // fallback if style calculation fails
          }

          if (htmlCloned.style.cssText && htmlCloned.style.cssText.includes('oklch')) {
            htmlCloned.style.cssText = htmlCloned.style.cssText.replace(/oklch\([^)]+\)/gi, 'rgb(15 23 42)');
          }
        }
      });
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function printElementContent(elementId: string, docTitle: string = 'طباعة المستند'): void {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((s) => s.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <title>${docTitle}</title>
        ${styles}
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { background: #ffffff !important; color: #000000 !important; font-family: system-ui, -apple-system, sans-serif; padding: 10px; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        ${element.outerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 4000);
}
