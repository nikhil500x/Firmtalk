import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 Client
// ✅ Only provide credentials if they are explicitly set
// Otherwise, let AWS SDK use default credential chain (IAM roles, environment, etc.)
const s3ClientConfig: any = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// ✅ Support multiple environment variable naming conventions
// Try AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY first, then fallback to AWS_ACCESS_KEY/AWS_SECRET_KEY
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;

// Only add credentials if both are provided
if (accessKeyId && secretAccessKey) {
  s3ClientConfig.credentials = {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  };
  console.log('✅ AWS credentials loaded from environment variables');
} else {
  console.warn('⚠️ AWS credentials not found in environment variables. Using default credential chain (IAM roles, etc.)');
  console.warn('   Expected: AWS_ACCESS_KEY_ID (or AWS_ACCESS_KEY) and AWS_SECRET_ACCESS_KEY (or AWS_SECRET_KEY)');
}

const s3Client = new S3Client(s3ClientConfig);

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// ✅ Validate required environment variables
if (!BUCKET_NAME) {
  console.error('❌ ERROR: AWS_S3_BUCKET_NAME environment variable is not set');
}

const UPLOAD_EXPIRATION = 300; // 5 minutes

export class S3Service {
  /**
   * Generate a pre-signed URL for uploading an expense receipt
   * @param fileName - Original file name
   * @param fileType - MIME type (e.g., 'image/jpeg', 'application/pdf')
   * @param userId - User ID for organizing files
   * @returns Pre-signed URL and the S3 key
   */
  static async generate_expense_receipt_UploadUrl(
    fileName: string,
    fileType: string,
    userId: number
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    // Generate unique file key with timestamp to avoid collisions
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `expense_receipts/${userId}/${timestamp}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      // Optional: Add metadata
      Metadata: {
        uploadedBy: userId.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate pre-signed URL
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: UPLOAD_EXPIRATION,
    });

    // Generate public URL (if bucket is public) or CloudFront URL
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      key,
      publicUrl,
    };
  }

  /**
   * Generate a pre-signed URL for uploading an engagement letter
   * @param fileName - Original file name
   * @param fileType - MIME type (e.g., 'application/pdf')
   * @param matterId - Matter ID for organizing files
   * @param userId - User ID for tracking uploader
   * @returns Pre-signed URL and the S3 key
   */
  static async generateEngagementLetterUploadUrl(
    fileName: string,
    fileType: string,
    matterId: number,
    userId: number
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    // Generate unique file key with timestamp to avoid collisions
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `engagement_letters/${matterId}/${userId}-${timestamp}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      // Optional: Add metadata
      Metadata: {
        matterId: matterId.toString(),
        uploadedBy: userId.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate pre-signed URL
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: UPLOAD_EXPIRATION,
    });

    // Generate public URL (if bucket is public) or CloudFront URL
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      key,
      publicUrl,
    };
  }

  /**
   * Delete a receipt from S3
   * @param key - S3 object key
   */
  static async deleteReceipt(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Generate a pre-signed URL for uploading a signed invoice
   * @param fileName - Original file name
   * @param fileType - MIME type (e.g., 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
   * @param invoiceId - Invoice ID for organizing files
   * @param userId - User ID for tracking uploader
   * @returns Pre-signed URL and the S3 key
   */
  static async generateInvoiceUploadUrl(
    fileName: string,
    fileType: string,
    invoiceId: number,
    userId: number
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    // Generate unique file key with timestamp to avoid collisions
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `invoices/${invoiceId}/${userId}-${timestamp}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      // Optional: Add metadata
      Metadata: {
        invoiceId: invoiceId.toString(),
        uploadedBy: userId.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate pre-signed URL
    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: UPLOAD_EXPIRATION,
    });

    // Generate public URL (if bucket is public) or CloudFront URL
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      key,
      publicUrl,
    };
  }

  /**
   * Upload file directly to S3 (for multer)
   * @param fileBuffer - File buffer
   * @param fileName - File name
   * @param fileType - MIME type
   * @param invoiceId - Invoice ID
   * @param userId - User ID
   * @returns Public URL and S3 key
   */
  static async uploadInvoiceFile(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    invoiceId: number,
    userId: number
  ): Promise<{ key: string; publicUrl: string }> {
    // ✅ Validate required configuration
    if (!BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is not set. Cannot upload invoice file.');
    }

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `invoices/${invoiceId}/${userId}-${timestamp}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: fileType,
      Metadata: {
        invoiceId: invoiceId.toString(),
        uploadedBy: userId.toString(),
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return {
      key,
      publicUrl,
    };
  }

  /**
   * Extract S3 key from public URL
   * @param url - Full S3 URL
   * @returns S3 key
   */
  static extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }
}

