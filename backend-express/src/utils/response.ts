import { Response } from 'express';

/**
 * Standardized API response helpers
 */

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  errors?: any;
}

/**
 * Send success response
 */
export const sendSuccess = (
  res: Response, 
  data: any = null, 
  message: string = 'Success', 
  statusCode: number = 200
): Response<ApiResponse> => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send error response
 */
export const sendError = (
  res: Response, 
  message: string = 'An error occurred', 
  statusCode: number = 400, 
  errors: any = null
): Response<ApiResponse> => {
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send validation error response
 */
export const sendValidationError = (res: Response, errors: any): Response<ApiResponse> => {
  return sendError(res, 'Validation failed', 422, errors);
};

/**
 * Send unauthorized response
 */
export const sendUnauthorized = (res: Response, message: string = 'Authentication required'): Response<ApiResponse> => {
  return sendError(res, message, 401);
};

/**
 * Send forbidden response
 */
export const sendForbidden = (res: Response, message: string = 'Insufficient permissions'): Response<ApiResponse> => {
  return sendError(res, message, 403);
};

/**
 * Send not found response
 */
export const sendNotFound = (res: Response, message: string = 'Resource not found'): Response<ApiResponse> => {
  return sendError(res, message, 404);
};

/**
 * Send internal server error response
 */
export const sendServerError = (res: Response, message: string = 'Internal server error'): Response<ApiResponse> => {
  return sendError(res, message, 500);
};

/**
 * Create success response object (for use with res.json())
 */
export const successResponse = (data: any = null, message: string = 'Success'): ApiResponse => {
  return {
    success: true,
    message,
    data,
  };
};

/**
 * Create error response object (for use with res.json())
 */
export const errorResponse = (message: string = 'An error occurred', errors: any = null): ApiResponse => {
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return response;
};

