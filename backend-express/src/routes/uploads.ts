import { Router, Request, Response } from 'express';
import { S3Service } from '../services/s3.service';

const router = Router();

/**
 * POST /api/uploads/receipt/presigned-url
 * Generate a pre-signed URL for receipt upload
 */
router.post('/receipt/presigned-url', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({
        success: false,
        message: 'fileName and fileType are required',
      });
    }

    // Validate file type (only allow images and PDFs)
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only images and PDFs are allowed.',
      });
    }

    const { uploadUrl, key, publicUrl } = await S3Service.generate_expense_receipt_UploadUrl(
      fileName,
      fileType,
      userId
    );

    return res.status(200).json({
      success: true,
      data: {
        uploadUrl,
        key,
        publicUrl,
      },
      message: 'Pre-signed URL generated successfully',
    });
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload URL',
    });
  }
});

/**
 * POST /api/uploads/engagement-letter/presigned-url
 * Generate a pre-signed URL for engagement letter upload
 */
router.post('/engagement-letter/presigned-url', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { fileName, fileType, matterId } = req.body;

    if (!fileName || !fileType || !matterId) {
      return res.status(400).json({
        success: false,
        message: 'fileName, fileType, and matterId are required',
      });
    }

    // Validate file type (only allow PDFs for engagement letters)
    const allowedTypes = [
      'application/pdf',
    ];

    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only PDFs are allowed for engagement letters.',
      });
    }

    const { uploadUrl, key, publicUrl } = await S3Service.generateEngagementLetterUploadUrl(
      fileName,
      fileType,
      parseInt(matterId),
      userId
    );

    return res.status(200).json({
      success: true,
      data: {
        uploadUrl,
        key,
        publicUrl,
      },
      message: 'Pre-signed URL generated successfully',
    });
  } catch (error) {
    console.error('Error generating pre-signed URL for engagement letter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload URL',
    });
  }
});

/**
 * DELETE /api/uploads/receipt
 * Delete a receipt from S3
 */
router.delete('/receipt', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required',
      });
    }

    const key = S3Service.extractKeyFromUrl(url);

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Invalid S3 URL',
      });
    }

    // Verify the file belongs to the user
    if (!key.startsWith(`expense_receipts/${userId}/`)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this file',
      });
    }

    await S3Service.deleteReceipt(key);

    return res.status(200).json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete receipt',
    });
  }
});

export default router;

