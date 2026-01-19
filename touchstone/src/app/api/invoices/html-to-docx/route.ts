import { NextRequest, NextResponse } from 'next/server';
import { Buffer as NodeBuffer, Blob as NodeBlob } from 'buffer';
import path from 'path';
import fs from 'fs';

// CRITICAL: html-docx-js checks global.Blob and global.Buffer at runtime
// We must ensure these are available before the library checks them

// Ensure global.Buffer and global.Blob are set
// In Next.js API routes, global should be available, but we ensure it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalObj = (typeof global !== 'undefined' ? global : globalThis) as any;

// Unconditionally set Buffer and Blob
globalObj.Buffer = NodeBuffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalObj.Blob = NodeBlob as any;
globalThis.Buffer = NodeBuffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Blob = NodeBlob;

// Load html-docx-js AFTER setting up globals
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HTMLtoDOCX = require('html-docx-js/build/api.js');

// Monkey-patch the library's internal module to fix path issues and Buffer access
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const internal = require('html-docx-js/build/internal.js');
  
  // Find the correct path to assets directory
  // In Next.js with webpack, require.resolve returns webpack-specific paths
  // Use process.cwd() to get the project root and build absolute path
  const assetsPath = path.join(process.cwd(), 'node_modules', 'html-docx-js', 'build', 'assets');
  
  // Get utils module for getMHTdocument
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const utils = require('html-docx-js/build/utils.js');
  
  // Patch addFiles to use correct asset paths
  if (internal.addFiles) {
    const self = internal; // Preserve `this` context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    internal.addFiles = function(zip: any, htmlSource: any, documentOptions: any) {
      // Use correct paths to asset files
      const contentTypesPath = path.join(assetsPath, 'content_types.xml');
      const relsPath = path.join(assetsPath, 'rels.xml');
      const documentRelsPath = path.join(assetsPath, 'document.xml.rels');
      
      // Ensure files exist
      if (!fs.existsSync(contentTypesPath) || !fs.existsSync(relsPath) || !fs.existsSync(documentRelsPath)) {
        throw new Error(`Asset files not found. Expected at: ${assetsPath}`);
      }
      
      zip.file('[Content_Types].xml', fs.readFileSync(contentTypesPath));
      zip.folder('_rels').file('.rels', fs.readFileSync(relsPath));
      const wordFolder = zip.folder('word');
      wordFolder.file('document.xml', self.renderDocumentFile(documentOptions));
      wordFolder.file('afchunk.mht', utils.getMHTdocument(htmlSource));
      wordFolder.folder('_rels').file('document.xml.rels', fs.readFileSync(documentRelsPath));
      return zip;
    };
  }
  
  // Patch generateDocument to always use Buffer path (bypassing global check)
  if (internal.generateDocument) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    internal.generateDocument = function(zip: any) {
      const buffer = zip.generate({ type: 'arraybuffer' });
      // Always use Buffer path (Node.js environment) - bypass global check
      return new NodeBuffer(new Uint8Array(buffer));
    };
  }
} catch (e) {
  // If patching fails, rely on global.Buffer being set
  console.error('Could not patch html-docx-js internal module:', e);
  throw e;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { html } = body;

    if (!html || typeof html !== 'string') {
      return NextResponse.json(
        { success: false, error: 'HTML content is required' },
        { status: 400 }
      );
    }

    // Ensure global.Buffer is accessible before calling library
    // The library checks global.Buffer at runtime in generateDocument
    globalObj.Buffer = NodeBuffer;
    globalObj.Blob = NodeBlob;
    
    // Convert HTML to DOCX
    // The library should use global.Buffer (Node.js path)
    const blob = HTMLtoDOCX.asBlob(html);

    // Convert the result to Buffer for response
    let buffer: Buffer;
    if (blob instanceof Buffer) {
      buffer = blob;
    } else if (blob instanceof ArrayBuffer) {
      buffer = Buffer.from(blob);
    } else if (blob && typeof blob.arrayBuffer === 'function') {
      const arrayBuffer = await blob.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buffer = Buffer.from(blob as any);
    }

    // Log buffer size for debugging
    console.log('Generated DOCX buffer size:', buffer.length, 'bytes');

    if (buffer.length === 0) {
      throw new Error('Generated DOCX is empty');
    }

    // Return DOCX file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="invoice.docx"`,
      },
    });
  } catch (error) {
    console.error('Error converting HTML to DOCX:', error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert HTML to DOCX',
      },
      { status: 500 }
    );
  }
}
