import 'dotenv/config'; // Load environment variables from .env file
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import sessionMiddleware from './config/session';
import authRoutes from './routes/auth';
import profileroutes from './routes/profile';
import usersRoutes from './routes/users';
import clientsRoutes from './routes/clients';
import contactsRoutes from './routes/contacts';
import invitationsRoutes from './routes/invitations';
import onboardingRoutes from './routes/onboarding';
import mattersRoutes from './routes/matters';
import timesheetsRoutes from './routes/timesheets';
import leavesRoutes from './routes/leaves';
import hrRoutes from './routes/hr';
import expensesRoutes from './routes/expenses';
import vendorsRoutes from './routes/vendors';
import invoicesRoutes from './routes/invoices';
import rateCardsRoutes from './routes/userRateCard';
import tasksRoutes from './routes/tasks';
import supportRoutes from './routes/support';
import azureRoutes from './routes/azure';
import notificationsRoutes from './routes/notifications';
import matterAnalyticsRoutes from './routes/matterAnalytics';
import timesheetAnalyticsRoutes from './routes/timesheetAnalytics';
import orgChartRoutes from './routes/orgChart';
import interactionsRoutes from './routes/interactions';
import opportunitiesRoutes from './routes/opportunities';
import leadsRoutes from './routes/leads';
import uploadsRoutes from './routes/uploads';
import approvalsRoutes from './routes/approvals';
import conflictsRoutes from './routes/conflicts';
import currencyRoutes from './routes/currency';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - CRITICAL for HTTPS behind nginx reverse proxy
// This allows Express to trust X-Forwarded-* headers from nginx
app.set('trust proxy', 1);

// Middleware
// CORS configuration - allow multiple origins in development
// Support both common localhost ports for Next.js (may switch between 3000 and 3001)
const allowedOrigins = process.env.FRONTEND_URL
  ? [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL.replace('https://', 'http://'), // Allow HTTP version too
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'https://firmtalk.ai',
      'http://firmtalk.ai',
    ]
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'https://firmtalk.ai', 'http://firmtalk.ai'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin when behind nginx proxy (same-origin requests)
    // This happens when requests come through nginx and origin might be missing
    if (!origin) {
      // In production, allow requests with no origin if they come from trusted proxy
      // This is safe because nginx is handling the routing
      if (process.env.NODE_ENV === 'production') {
        return callback(null, true);
      }
      // In development, also allow
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
      callback(new Error(`Not allowed by CORS - origin: ${origin}`));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200, // Support legacy browsers
}));

// Increase JSON body parser limit to handle large bulk uploads (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Session middleware
app.use(sessionMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/profile', profileroutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/matters', matterAnalyticsRoutes);
app.use('/api/matters', mattersRoutes);
app.use('/api/analytics', timesheetAnalyticsRoutes);
app.use('/api/timesheets', timesheetsRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/userRateCard', rateCardsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/azure', azureRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/org-chart', orgChartRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/conflicts', conflictsRoutes);
app.use('/api/currency', currencyRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});

export default app;

