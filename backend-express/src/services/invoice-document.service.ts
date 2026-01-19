import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  client: {
    name: string;
    address?: string | null;
  };
  matters: Array<{
    id: number;
    title: string;
  }>;
  timesheets: Array<{
    date: Date;
    userName: string;
    description: string | null;
    billedHours: number | null;
    hourlyRate: number | null;
    billedAmount: number | null;
  }>;
  subtotal: number;
  discountType: string | null;
  discountValue: number | null;
  discountAmount: number;
  finalAmount: number;
  invoiceCurrency: string | null;
  userExchangeRate: number | null;
  amountInINR: number | null;
  description: string;
  notes: string | null;
  billingLocation: string;
}

export class InvoiceDocumentService {
  /**
   * Generate Word document for invoice
   */
  static async generateInvoiceDocument(data: InvoiceData): Promise<Buffer> {
    const sections = [];

    // Header section
    sections.push(
      new Paragraph({
        text: 'Touchstone Partners',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: 'Legal Services',
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // Invoice details section
    sections.push(
      new Paragraph({
        text: 'INVOICE',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 400 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Invoice Number: ', bold: true }),
          new TextRun({ text: data.invoiceNumber }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Invoice Date: ', bold: true }),
          new TextRun({ text: data.invoiceDate.toLocaleDateString('en-GB') }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Due Date: ', bold: true }),
          new TextRun({ text: data.dueDate.toLocaleDateString('en-GB') }),
        ],
        spacing: { after: 400 },
      })
    );

    // Bill To section
    sections.push(
      new Paragraph({
        text: 'Bill To:',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
      }),
      new Paragraph({
        text: data.client.name,
        spacing: { after: 100 },
      })
    );

    if (data.client.address) {
      sections.push(
        new Paragraph({
          text: data.client.address,
          spacing: { after: 400 },
        })
      );
    }

    // Matters section (if multi-matter)
    if (data.matters.length > 1) {
      sections.push(
        new Paragraph({
          text: 'Matters:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );

      data.matters.forEach(matter => {
        sections.push(
          new Paragraph({
            text: `• ${matter.title}`,
            spacing: { after: 100 },
          })
        );
      });

      sections.push(new Paragraph({ text: '', spacing: { after: 400 } }));
    }

    // Description
    if (data.description) {
      sections.push(
        new Paragraph({
          text: 'Description:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        }),
        new Paragraph({
          text: data.description,
          spacing: { after: 400 },
        })
      );
    }

    // Timesheets table
    if (data.timesheets.length > 0) {
      sections.push(
        new Paragraph({
          text: 'Timesheet Details:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );

      // Table header
      const tableRows = [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'Date', alignment: AlignmentType.CENTER })],
              shading: { fill: 'D3D3D3' },
              width: { size: 15, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Lawyer', alignment: AlignmentType.CENTER })],
              shading: { fill: 'D3D3D3' },
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Description', alignment: AlignmentType.CENTER })],
              shading: { fill: 'D3D3D3' },
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Hours', alignment: AlignmentType.CENTER })],
              shading: { fill: 'D3D3D3' },
              width: { size: 10, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Rate', alignment: AlignmentType.CENTER })],
              shading: { fill: 'D3D3D3' },
              width: { size: 12, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Amount', alignment: AlignmentType.CENTER })],
              shading: { fill: 'D3D3D3' },
              width: { size: 13, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ];

      // Table rows
      data.timesheets.forEach(ts => {
        const hours = ts.billedHours ? (ts.billedHours / 60).toFixed(2) : '0.00';
        const rate = ts.hourlyRate ? ts.hourlyRate.toFixed(2) : '0.00';
        const amount = ts.billedAmount ? ts.billedAmount.toFixed(2) : '0.00';

        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ text: ts.date.toLocaleDateString('en-GB') })],
              }),
              new TableCell({
                children: [new Paragraph({ text: ts.userName })],
              }),
              new TableCell({
                children: [new Paragraph({ text: ts.description || '-' })],
              }),
              new TableCell({
                children: [new Paragraph({ text: hours, alignment: AlignmentType.RIGHT })],
              }),
              new TableCell({
                children: [new Paragraph({ text: rate, alignment: AlignmentType.RIGHT })],
              }),
              new TableCell({
                children: [new Paragraph({ text: amount, alignment: AlignmentType.RIGHT })],
              }),
            ],
          })
        );
      });

      sections.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE },
            bottom: { style: BorderStyle.SINGLE },
            left: { style: BorderStyle.SINGLE },
            right: { style: BorderStyle.SINGLE },
            insideHorizontal: { style: BorderStyle.SINGLE },
            insideVertical: { style: BorderStyle.SINGLE },
          },
        })
      );
    }

    // Summary section
    sections.push(
      new Paragraph({ text: '', spacing: { after: 400 } }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Subtotal: ', bold: true }),
          new TextRun({ text: `${data.invoiceCurrency || 'INR'} ${data.subtotal.toFixed(2)}` }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 100 },
      })
    );

    if (data.discountAmount > 0) {
      const discountTypeText = data.discountType === 'percentage' 
        ? `${data.discountValue}%` 
        : `${data.invoiceCurrency || 'INR'} ${data.discountValue?.toFixed(2)}`;
      
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Discount (${discountTypeText}): `, bold: true }),
            new TextRun({ text: `${data.invoiceCurrency || 'INR'} ${data.discountAmount.toFixed(2)}` }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 },
        })
      );
    }

    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Total: ', bold: true, size: 28 }),
          new TextRun({ text: `${data.invoiceCurrency || 'INR'} ${data.finalAmount.toFixed(2)}`, size: 28 }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 200 },
      })
    );

    // INR equivalent (if multi-currency)
    if (data.userExchangeRate && data.amountInINR) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Equivalent in INR (Rate: ${data.userExchangeRate.toFixed(2)}): `, bold: true }),
            new TextRun({ text: `INR ${data.amountInINR.toFixed(2)}` }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 400 },
        })
      );
    }

    // Notes
    if (data.notes) {
      sections.push(
        new Paragraph({
          text: 'Notes:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: data.notes,
          spacing: { after: 400 },
        })
      );
    }

    // Payment terms
    sections.push(
      new Paragraph({
        text: 'Payment Terms:',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      new Paragraph({
        text: 'Payment is due within the specified due date. Please make payment via bank transfer.',
        spacing: { after: 400 },
      })
    );

    const doc = new Document({
      sections: [
        {
          children: sections,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}

