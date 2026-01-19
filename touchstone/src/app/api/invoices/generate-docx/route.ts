import { NextRequest, NextResponse } from 'next/server';
// @ts-expect-error - officegen doesn't have proper types
import officegen from 'officegen';
import { PassThrough } from 'stream';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceData } = body;

    if (!invoiceData) {
      return NextResponse.json(
        { success: false, error: 'Invoice data is required' },
        { status: 400 }
      );
    }

    // Format helper functions
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    };

    const currency = invoiceData.invoiceCurrency || 'INR';
    const formatAmount = (amount: number) => {
      const symbols: Record<string, string> = {
        INR: 'Rs.',
        USD: '$',
        EUR: '€',
        GBP: '£',
        AED: 'AED',
        JPY: '¥',
      };
      const symbol = symbols[currency] || currency;
      return `${symbol} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Create a new DOCX document
    const docx = officegen('docx');

    // Set document properties
    docx.setDocSubject('Invoice');
    docx.setDocKeywords('invoice');

    // Company Header
    let pObj = docx.createP();
    pObj.addText('Touchstone Partners', { font_size: 24, bold: true, color: '4472C4' });

    pObj = docx.createP();
    pObj.addText('One BKC, 808 B, Tower C, Bandra Kurla Complex, Mumbai – 400 051');

    pObj = docx.createP();
    pObj.addText('Tel: +91 22 6913 4305');

    pObj = docx.createP();
    pObj.addText('E: accounts@touchstonepartners.com | W: touchstonepartners.com');

    // Add spacing
    docx.createP();
    docx.createP();

    // BILL TO Section
    pObj = docx.createP();
    pObj.addText('BILL TO', { font_size: 14, bold: true, color: '4472C4' });

    pObj = docx.createP();
    pObj.addText(invoiceData.clientName || 'Client Name', { bold: true });

    if (invoiceData.clientAddress) {
      pObj = docx.createP();
      pObj.addText(invoiceData.clientAddress);
    }

    if (invoiceData.matterTitle) {
      pObj = docx.createP();
      pObj.addText('Matter: ', { bold: true });
      pObj.addText(invoiceData.matterTitle);
    }

    // Add spacing
    docx.createP();

    // INVOICE DETAILS Section
    pObj = docx.createP();
    pObj.addText('INVOICE DETAILS', { font_size: 14, bold: true, color: '4472C4' });

    pObj = docx.createP();
    pObj.addText('Invoice Date: ', { bold: true });
    pObj.addText(formatDate(invoiceData.invoiceDate));

    pObj = docx.createP();
    pObj.addText('Due Date: ', { bold: true });
    pObj.addText(formatDate(invoiceData.dueDate));

    pObj = docx.createP();
    pObj.addText('Invoice Number: ', { bold: true });
    pObj.addText(`#${invoiceData.invoiceNumber}`, { bold: true });

    // Add spacing
    docx.createP();

    // DESCRIPTION OF SERVICES
    pObj = docx.createP();
    pObj.addText('DESCRIPTION OF SERVICES', { font_size: 14, bold: true, color: '4472C4' });

    pObj = docx.createP();
    pObj.addText(invoiceData.description || 'Service description');

    // Add spacing
    docx.createP();

    // AMOUNT SUMMARY Section
    pObj = docx.createP();
    pObj.addText('AMOUNT SUMMARY', { font_size: 14, bold: true, color: '4472C4' });

    docx.createP();

    // Subtotal (using paragraphs instead of tables to avoid text rendering bugs)
    pObj = docx.createP();
    pObj.addText('Subtotal: ', { bold: true });
    pObj.addText(formatAmount(invoiceData.subtotal || invoiceData.amount));

    // Discount (if applicable)
    if (invoiceData.discountAmount && invoiceData.discountAmount > 0) {
      pObj = docx.createP();
      pObj.addText(`Discount ${invoiceData.discountType === 'percentage' ? `(${invoiceData.discountValue}%)` : ''}: `, { bold: true });
      pObj.addText(`-${formatAmount(invoiceData.discountAmount)}`, { color: 'CC0000' });
    }

    // Add spacing before total
    docx.createP();

    // Total row with background (using paragraph with border)
    pObj = docx.createP({ border_bottom: { style: 'double', width: 6 } });
    pObj.addText('Total Amount Due: ', { bold: true, font_size: 16 });
    pObj.addText(formatAmount(invoiceData.amount), { bold: true, font_size: 18, color: '2563EB' });

    // Add spacing
    docx.createP();

    // NOTES (if present)
    if (invoiceData.notes) {
      pObj = docx.createP();
      pObj.addText('NOTES', { font_size: 14, bold: true, color: '4472C4' });

      pObj = docx.createP();
      pObj.addText(invoiceData.notes);
    }

    // Generate the document as a buffer
    const chunks: Buffer[] = [];

    return new Promise<NextResponse>((resolve, reject) => {
      // Create a PassThrough stream to collect data
      const outputStream = new PassThrough();

      outputStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      outputStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('Generated DOCX buffer size:', buffer.length, 'bytes');

        if (buffer.length === 0) {
          reject(new Error('Generated DOCX is empty'));
          return;
        }

        resolve(new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="Invoice-${invoiceData.invoiceNumber}.docx"`,
          },
        }));
      });

      outputStream.on('error', (err: Error) => {
        console.error('Error generating DOCX:', err);
        reject(err);
      });

      // Generate the document and pipe to output stream
      docx.generate(outputStream);
    });

  } catch (error) {
    console.error('Error generating DOCX:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate DOCX',
      },
      { status: 500 }
    );
  }
}
