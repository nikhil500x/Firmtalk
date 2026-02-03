# Firmtalk Improvement Plan

## Overview
This document outlines all identified hardcoded values, missing features, and improvement opportunities in the Firmtalk application.

---

## 1. HARDCODED VALUES TO MAKE DYNAMIC

### 1.1 Create Configuration Tables (Database)

| Config Type | Current Location | Proposed Solution |
|-------------|------------------|-------------------|
| **Practice Areas** | `MatterMasterDialog.tsx:167-174` | New `practice_areas` table |
| **Matter Types** | `MatterMasterDialog.tsx:176-182` | New `matter_types` table |
| **Activity Types** | `TimesheetDialog.tsx:146-156` | New `activity_types` table |
| **Expense Categories** | `TimesheetDialog.tsx:1394-1400` | New `expense_categories` table |
| **Leave Types** | `LeavesTable.tsx:259-268` | New `leave_types` table |
| **Industries** | Multiple files | New `industries` table |
| **Currencies** | `MatterMasterDialog.tsx:245` | New `currencies` table |
| **Billing Rate Types** | `MatterMasterDialog.tsx:184` | New `billing_types` table |
| **Matter Statuses** | `MatterMasterDialog.tsx:186` | New `matter_statuses` table |

### 1.2 Locations Enhancement

**Current State:**
- Locations exist in database but office codes hardcoded in `invoices.ts:39-44`
- No UI to manage locations

**Required Changes:**
```sql
ALTER TABLE locations ADD COLUMN office_code VARCHAR(10);
ALTER TABLE locations ADD COLUMN invoice_prefix VARCHAR(5);
ALTER TABLE locations ADD COLUMN currency VARCHAR(3) DEFAULT 'INR';
ALTER TABLE locations ADD COLUMN tax_rate DECIMAL(5,2);
ALTER TABLE locations ADD COLUMN bank_details TEXT;
```

**New Features Needed:**
- [ ] Location management UI (Admin > Settings > Locations)
- [ ] Add/Edit/Delete locations
- [ ] Set default location per user
- [ ] Location-based invoice numbering

### 1.3 Firm Configuration

**Currently Hardcoded:**
- Firm name "TouchStone" in `invitations.ts`
- Email templates
- Default currency (INR)
- File size limits (5MB)

**Proposed: `firm_settings` table**
```sql
CREATE TABLE firm_settings (
  setting_id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE,
  setting_value TEXT,
  setting_type VARCHAR(20), -- 'string', 'number', 'boolean', 'json'
  category VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Example entries:
INSERT INTO firm_settings (setting_key, setting_value, setting_type, category) VALUES
('firm_name', 'Firmtalk', 'string', 'general'),
('default_currency', 'INR', 'string', 'billing'),
('max_file_size_mb', '10', 'number', 'uploads'),
('invoice_prefix', 'FT', 'string', 'billing'),
('email_from_name', 'Firmtalk Legal', 'string', 'email'),
('working_hours_per_day', '8', 'number', 'timesheet'),
('fiscal_year_start', '04-01', 'string', 'finance');
```

---

## 2. MISSING CRUD OPERATIONS

### 2.1 Entities Missing Full CRUD

| Entity | Create | Read | Update | Delete | Bulk Ops |
|--------|--------|------|--------|--------|----------|
| Contacts | ✅ | ✅ | ✅ | ❌ UI | ❌ |
| Timesheets | ✅ | ✅ | ✅ | ✅ | ❌ |
| Leaves | ✅ | ✅ | ✅ | ❌ | ❌ |
| Rate Cards | ✅ | ✅ | ⚠️ | ❌ | ❌ |
| Vendors | ✅ | ✅ | ✅ | ❌ Soft | ❌ |
| Expenses | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| Invoices | ✅ | ✅ | ⚠️ | ❌ | ❌ |

### 2.2 Required Implementations

**Priority 1 - Delete Operations:**
- [ ] Contact delete button in ContactDetailView
- [ ] Leave cancel/delete for pending leaves
- [ ] Vendor soft delete (set active_status = false)

**Priority 2 - Bulk Operations:**
- [ ] Bulk approve timesheets
- [ ] Bulk approve leaves
- [ ] Bulk update matter status
- [ ] Bulk assign tasks

---

## 3. VALIDATION GAPS

### 3.1 Frontend Validation

| Form | Missing Validation |
|------|-------------------|
| **Timesheet** | Max 24 hours/day, No future dates, No negative hours |
| **Matter** | Deadline > Start date, Unique matter code |
| **Leave** | Balance check, No overlapping dates |
| **Expense** | Amount > 0, Valid matter if linked |
| **Invoice** | Due date > Invoice date, Valid timesheets |

### 3.2 Backend Validation

| Route | Missing Validation |
|-------|-------------------|
| `POST /timesheets` | Overlapping entries, Closed matter check |
| `POST /leaves` | Balance availability, Date overlap |
| `POST /invoices` | Duplicate timesheet inclusion |
| `POST /matters` | Duplicate matter code, Valid assigned lawyer |
| `PUT /expenses` | Matter status check |

### 3.3 Validation Implementation Plan

```typescript
// Example: Timesheet validation middleware
const validateTimesheet = async (req, res, next) => {
  const { user_id, date, hours_worked, matter_id } = req.body;

  // 1. Check max hours per day
  const existingHours = await prisma.timesheets.aggregate({
    where: { user_id, date: new Date(date) },
    _sum: { hours_worked: true }
  });

  const totalHours = (existingHours._sum.hours_worked || 0) + hours_worked;
  if (totalHours > 1440) { // 24 hours in minutes
    return res.status(400).json({ error: 'Total hours exceed 24 hours for this date' });
  }

  // 2. Check matter is active
  if (matter_id) {
    const matter = await prisma.matters.findUnique({ where: { matter_id } });
    if (matter?.status === 'closed') {
      return res.status(400).json({ error: 'Cannot add timesheet to closed matter' });
    }
  }

  next();
};
```

---

## 4. PERFORMANCE IMPROVEMENTS

### 4.1 Missing Pagination

| Endpoint | Current State | Fix |
|----------|---------------|-----|
| `GET /timesheets` | Returns ALL | Add `?page=1&limit=50` |
| `GET /timesheets/user/:id` | Returns ALL | Add pagination |
| `GET /contacts` | Returns ALL | Add pagination |
| `GET /vendors` | Returns ALL | Add pagination |
| `GET /expenses/recurring` | Returns ALL | Add pagination |

### 4.2 N+1 Query Fixes

**Current Issue (timesheets.ts:66-122):**
```typescript
// BAD - Multiple nested includes
include: {
  user: { select: { name: true, email: true } },
  matter: {
    select: {
      client: { select: { client_name: true } }
    }
  },
  expenses: {
    select: {
      vendor: { select: { vendor_name: true } }
    }
  },
  invoice_timesheets: {
    include: { invoice: true }  // PROBLEM: Full include
  }
}
```

**Fix:**
```typescript
// GOOD - Selective fields only
include: {
  user: { select: { user_id: true, name: true } },
  matter: { select: { matter_id: true, matter_title: true, client_id: true } },
  invoice_timesheets: {
    select: {
      invoice_id: true,
      invoice: { select: { invoice_number: true, status: true } }
    }
  }
}
```

### 4.3 Missing Database Indexes

```sql
-- Add these indexes for query performance
CREATE INDEX idx_timesheets_user_date ON timesheets(user_id, date);
CREATE INDEX idx_timesheets_matter_date ON timesheets(matter_id, date);
CREATE INDEX idx_expenses_matter ON onetime_expenses(matter_id);
CREATE INDEX idx_expense_payments_expense ON expense_payments(onetime_expense_id);
CREATE INDEX idx_leaves_user_dates ON leaves(user_id, start_date, end_date);
CREATE INDEX idx_tasks_due_date ON tasks(due_date, status);
```

---

## 5. UI/UX IMPROVEMENTS

### 5.1 Missing Table Features

| Table | Missing Features |
|-------|------------------|
| **All Tables** | Export CSV/PDF, Saved filters, Column sorting persistence |
| **Timesheets** | Bulk select, Group by date/matter, Daily summary row |
| **Invoices** | Overdue indicator, Payment status badge |
| **Leaves** | Balance indicator, Calendar view |
| **Tasks** | Kanban view, Drag-drop status change |

### 5.2 Missing Form Features

| Form | Missing Features |
|------|------------------|
| **Timesheet** | Duplicate detection, Weekly summary, Copy from previous |
| **Matter** | Team availability check, Conflict warning |
| **Expense** | Receipt preview, Vendor quick-create |
| **Leave** | Balance display, Overlap warning |

### 5.3 Dashboard Improvements

**Current Gaps:**
- No firm-wide dashboard for partners
- No billing summary widget
- No overdue tasks widget
- No pending approvals count

**Proposed Widgets:**
- [ ] Monthly billing summary
- [ ] Outstanding invoices
- [ ] Pending timesheets for approval
- [ ] Pending leaves for approval
- [ ] Upcoming deadlines
- [ ] Team utilization chart

---

## 6. MISSING FEATURES

### 6.1 Audit Trail

**Not Tracked Currently:**
- Matter status changes
- Invoice status changes
- Leave approval/rejection with reason
- User role changes
- Rate card changes

**Proposed: `audit_logs` table**
```sql
CREATE TABLE audit_logs (
  log_id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50),
  entity_id INT,
  action VARCHAR(20), -- 'create', 'update', 'delete', 'approve', 'reject'
  old_values JSONB,
  new_values JSONB,
  changed_by INT REFERENCES users(user_id),
  changed_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT
);
```

### 6.2 Soft Deletes

**Entities Needing Soft Delete:**
- Matters (for historical reporting)
- Invoices (legal requirements)
- Timesheets (audit trail)
- Users (preserve references)

**Implementation:**
```sql
ALTER TABLE matters ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE timesheets ADD COLUMN deleted_at TIMESTAMP;
-- Add to all queries: WHERE deleted_at IS NULL
```

### 6.3 Notification System Enhancement

**Missing:**
- Email notification preferences per user
- In-app notification for:
  - Leave approval/rejection
  - Task assignment
  - Invoice payment received
  - Matter deadline approaching
- Batch notification processing

### 6.4 Reporting Module

**Missing Reports:**
- Billable hours by user/matter/client
- Invoice aging report
- Leave balance report
- Expense summary by category
- Matter profitability analysis
- User utilization report

---

## 7. ROLE & PERMISSION IMPROVEMENTS

### 7.1 Hardcoded Role Checks

**Current (Multiple Files):**
```typescript
const canSeeAllLeaves = ['superadmin','partner', 'admin', 'support', 'it', 'hr'].includes(role?.name || '');
```

**Fix: Use Permission Database**
```typescript
// Middleware
const checkPermission = (permission: string) => async (req, res, next) => {
  const userPermissions = await prisma.role_permissions.findMany({
    where: { role_id: req.user.role_id },
    include: { permission: true }
  });

  const hasPermission = userPermissions.some(rp => rp.permission.name === permission);
  if (!hasPermission) {
    return res.status(403).json({ error: 'Permission denied' });
  }
  next();
};

// Usage
router.get('/leaves', checkPermission('leave:read:all'), getAllLeaves);
```

### 7.2 Permission Granularity

**Add These Permissions:**
```
leave:read:own      - View own leaves
leave:read:team     - View team leaves (reporting manager)
leave:read:all      - View all leaves (HR, Admin)
leave:approve:team  - Approve team leaves
leave:approve:all   - Approve any leave

timesheet:read:own
timesheet:read:team
timesheet:read:all
timesheet:approve:team
timesheet:approve:all

matter:read:assigned
matter:read:all
matter:create
matter:update:own
matter:update:all
```

---

## 8. IMPLEMENTATION PRIORITY

### Phase 1: Critical (Week 1-2)
1. [ ] Add pagination to all list endpoints
2. [ ] Fix N+1 queries in timesheets and matters
3. [ ] Add missing database indexes
4. [ ] Implement basic validation middleware
5. [ ] Add contact delete functionality

### Phase 2: High Priority (Week 3-4)
1. [ ] Create configuration tables (practice_areas, matter_types, etc.)
2. [ ] Build Settings UI for managing configurations
3. [ ] Implement soft deletes
4. [ ] Add audit logging for critical actions
5. [ ] Fix hardcoded role checks with permission system

### Phase 3: Medium Priority (Week 5-6)
1. [ ] Location management with invoice codes
2. [ ] Firm settings table and UI
3. [ ] Bulk operations (approve, update, delete)
4. [ ] Export functionality (CSV, PDF)
5. [ ] Enhanced validation (overlaps, duplicates)

### Phase 4: Enhancements (Week 7-8)
1. [ ] Dashboard widgets
2. [ ] Notification preferences
3. [ ] Reporting module
4. [ ] Calendar view for leaves
5. [ ] Kanban view for tasks

---

## 9. DATABASE MIGRATION PLAN

### New Tables Required
```sql
-- 1. Configuration tables
CREATE TABLE practice_areas (id SERIAL PK, name VARCHAR(100) UNIQUE, active BOOLEAN DEFAULT true);
CREATE TABLE matter_types (id SERIAL PK, name VARCHAR(100) UNIQUE, active BOOLEAN DEFAULT true);
CREATE TABLE activity_types (id SERIAL PK, name VARCHAR(100) UNIQUE, category VARCHAR(50), active BOOLEAN DEFAULT true);
CREATE TABLE expense_categories (id SERIAL PK, name VARCHAR(100) UNIQUE, parent_id INT, active BOOLEAN DEFAULT true);
CREATE TABLE leave_types (id SERIAL PK, name VARCHAR(100) UNIQUE, code VARCHAR(20), days_allowed INT, active BOOLEAN DEFAULT true);
CREATE TABLE industries (id SERIAL PK, name VARCHAR(100) UNIQUE, active BOOLEAN DEFAULT true);
CREATE TABLE currencies (code VARCHAR(3) PK, name VARCHAR(50), symbol VARCHAR(5), active BOOLEAN DEFAULT true);

-- 2. System tables
CREATE TABLE firm_settings (id SERIAL PK, key VARCHAR(100) UNIQUE, value TEXT, type VARCHAR(20));
CREATE TABLE audit_logs (id SERIAL PK, entity_type VARCHAR(50), entity_id INT, action VARCHAR(20), old_values JSONB, new_values JSONB, changed_by INT, changed_at TIMESTAMP);

-- 3. Alterations
ALTER TABLE locations ADD COLUMN office_code VARCHAR(10), ADD COLUMN invoice_prefix VARCHAR(5);
ALTER TABLE matters ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{}';
```

---

## 10. QUICK WINS (Can Do Today)

1. **Add max hours validation in TimesheetDialog** - Simple frontend check
2. **Add deadline > start date validation in MatterDialog** - Simple frontend check
3. **Show leave balance in leave application form** - API already exists
4. **Add overdue badge to invoices table** - Simple date comparison
5. **Fix contact delete button** - Backend exists, just add UI button

---

## Summary Statistics

| Category | Issues Found |
|----------|--------------|
| Hardcoded Values | 15+ |
| Missing Validation | 20+ |
| Performance Issues | 8 |
| Missing CRUD | 6 |
| UI/UX Gaps | 15+ |
| Missing Features | 10+ |
| **Total Items** | **70+** |

---

*Document generated: February 2026*
*Based on codebase analysis of Firmtalk v1.0*
