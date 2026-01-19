# Git Pull Changes Summary

This document summarizes all the changes that were pulled from the remote repository. The changes span multiple modules and include database schema updates, backend API modifications, and frontend UI improvements.

## 📅 Recent Commits Overview

The following pull requests were merged:
- **PR #84 (Neston)**: Timesheet billing hours format change and database model updates
- **PR #83 (Myron)**: User code/type fixes, invoice due date logic, rate card improvements
- **PR #82 (Myron)**: Task management improvements (optional matter/client, multi-filter)
- **PR #81 (Myron)**: Invoice/User/Timesheet/Task table sorting, HR updates
- **PR #80 (Neston)**: Various improvements

---

## 🗄️ Database Schema Changes

### 1. Timesheet Hours Format Change (PR #84)
**Migration**: `20251226120136_client_matter_codes_creation_requester_and_timesheets_hours_as_int`

**Changes**:
- **BREAKING**: Changed `hours_worked`, `billable_hours`, and `non_billable_hours` from `DOUBLE PRECISION` (decimal) to `INTEGER` (whole numbers)
- Hours are now stored as integers (e.g., 8 instead of 8.5)
- **Impact**: All timesheet entries now use whole hour values only

**Files Affected**:
- `backend-express/prisma/schema.prisma`
- `backend-express/src/routes/timesheets.ts`
- `backend-express/src/routes/timesheetAnalytics.ts`
- All timesheet-related frontend components

### 2. Client and Matter Codes (PR #84)
**Migration**: `20251226120136_client_matter_codes_creation_requester_and_timesheets_hours_as_int`

**Changes**:
- Added `client_code` field to `clients` table (unique)
- Added `matter_code` field to `matters` table
- Added `client_creation_requested_by` field to track who requested client creation
- Added `matter_creation_requested_by` field to track who requested matter creation

**Purpose**: Better tracking and identification of clients and matters with unique codes

### 3. Task Management Updates (PR #82, #81)
**Migrations**:
- `20251224061427_add_task_assignments`
- `20251224073254_add_completed_by_to_task_assignments`
- `20251224121144_make_client_matter_optional_in_tasks`

**Changes**:
- **Removed** `assigned_to` field from `tasks` table (single assignment)
- **Added** `task_assignments` junction table for multiple user assignments
  - Fields: `task_id`, `user_id`, `status`, `completed_at`, `completed_by`
  - Supports multiple users per task
- **Made `client_id` and `matter_id` optional** in tasks table
  - Tasks can now exist without being tied to a client or matter
- Added `completed_by` field to track who completed the task assignment

**Purpose**: 
- Support multiple assignees per task
- Allow tasks to exist independently of clients/matters
- Track task completion by individual assignees

### 4. Conflict Checker System (PR #80)
**Migration**: `20251222114949_engagement_letter_and_conflict_checker_initial`

**Changes**:
- Added `matter_conflicts` table for tracking conflicts
  - Fields: `conflict_id`, `matter_id`, `raised_by`, `conflict_type`, `conflict_description`, `conflict_details`, `severity`, `status`, `resolved_by`, `resolution_notes`, timestamps
- Added to `matters` table:
  - `conflict_raise_tokens` (JSONB) - tokens for conflict raising
  - `conflict_status` (TEXT)
  - `engagement_letter_url` (TEXT)
  - `has_conflict` (BOOLEAN)

**Purpose**: Enable partners to raise and track conflicts for matters

---

## 🔧 Backend API Changes

### 1. Timesheet Routes (`backend-express/src/routes/timesheets.ts`)
**Changes**:
- Updated to handle integer hours instead of decimal
- Modified billing hours format calculations
- Updated timesheet analytics to work with integer hours

### 2. Timesheet Analytics (`backend-express/src/routes/timesheetAnalytics.ts`)
**Changes**:
- Adjusted analytics to work with integer hours format
- Updated aggregation calculations

### 3. User Routes (`backend-express/src/routes/users.ts`)
**Changes** (PR #83):
- Fixed user code and type handling in both onboarding and user management
- User code and type are now automatically generated/updated on user creation/update
- Added table sorting functionality

### 4. Onboarding Routes (`backend-express/src/routes/onboarding.ts`)
**Changes** (PR #83):
- Synchronized user code and type logic with user management page
- Ensured consistency between onboarding and user creation flows

### 5. Task Routes (`backend-express/src/routes/tasks.ts`)
**Changes** (PR #82, #81):
- Updated to support optional client/matter
- Added support for multiple task assignments
- Implemented multi-filter options for priority
- Fixed date filtering in "My Tasks" and "All Tasks"
- Added logic to automatically select client when matter is selected
- Added logic to filter matters by client when client is selected first
- Prevented status changes once task is completed
- Added "completed by" tracking

### 6. Invoice Routes (`backend-express/src/routes/invoices.ts`)
**Changes** (PR #83):
- Updated invoice creation/update logic
- Added due date calculation based on timesheet dates

### 7. Matter Routes (`backend-express/src/routes/matters.ts`)
**Changes**:
- Added support for engagement letter uploads
- Added conflict checking functionality
- Updated matter creation/update to handle new fields

### 8. New Routes Added
- **`backend-express/src/routes/conflicts.ts`** (NEW):
  - Conflict verification endpoints
  - Conflict raising and resolution endpoints
  - Token-based conflict raise system

### 9. New Services Added
- **`backend-express/src/services/conflictchecker.service.ts`** (NEW):
  - Conflict checking logic
  - Token generation and verification
  - Conflict detection algorithms

---

## 🎨 Frontend Changes

### 1. Timesheet Components
**Files Modified**:
- `touchstone/src/components/timesheet/TimesheetDialog.tsx`
- `touchstone/src/components/timesheet/TimesheetsTable.tsx`
- `touchstone/src/components/timesheet/TimesheetCalendar.tsx`
- `touchstone/src/components/timesheet/QuickTimesheetEntry.tsx`
- `touchstone/src/components/timesheet/TimesheetOverview.tsx`

**Changes**:
- Updated to handle integer hours (removed decimal input)
- Added multi-filter functionality for timesheet status
- Updated timesheet display format
- Fixed billing hours calculations

### 2. Invoice Components
**Files Modified**:
- `touchstone/src/components/invoice/InvoiceDialog.tsx`
- `touchstone/src/components/invoice/InvoicesTable.tsx`
- `touchstone/src/components/invoice/RateCardTable.tsx`

**Changes** (PR #83):
- **Invoice Due Date Logic**:
  - Due date is automatically set to the date of the earliest selected timesheet
  - Users can only select dates after the earliest timesheet date
  - Due date is automatically set to 60 days after the latest selected timesheet
- **Rate Card Improvements**:
  - Fixed inline editing for effective and end dates
  - Switched color scheme for active/inactive toggle
- **Table Sorting**: Added sorting functionality to invoices table

### 3. Task Components
**Files Modified**:
- `touchstone/src/components/task/TaskDialog.tsx`
- `touchstone/src/components/task/MyTask.tsx`
- `touchstone/src/components/task/AllTask.tsx`

**Changes** (PR #82, #81):
- **Multiple Assignments**: Tasks can now be assigned to multiple users
- **Optional Client/Matter**: Client and matter fields are now optional
- **Multi-Filter**: Added multi-filter option for priority in both "My Tasks" and "All Tasks"
- **Date Filtering**: Fixed filter by date functionality
- **Auto-Selection Logic**:
  - When matter is selected, client is automatically selected
  - When client is selected first, only matters tied to that client are shown
- **Status Management**:
  - Cannot change status once task is completed
  - Displays "completed by" user information
  - Dynamic changes when switching from "to do" to "in progress"

### 4. User Management
**Files Modified**:
- `touchstone/src/app/(main)/user/page.tsx`
- `touchstone/src/components/user/UserDialog.tsx`
- `touchstone/src/app/(auth)/onboarding/[token]/page.tsx`

**Changes** (PR #83):
- Fixed user code and type handling
- User code and type are now automatically generated (not visible in frontend)
- Synchronized logic between onboarding and user management pages
- Added table sorting functionality

### 5. HR Module
**Files Modified**:
- `touchstone/src/app/(main)/hr/page.tsx`
- `touchstone/src/app/(main)/hr/users/[userId]/page.tsx` (renamed from `lawyers/[userId]/page.tsx`)
- `touchstone/src/components/hr/LawyerOverview.tsx` (now `UserOverview.tsx`)
- `touchstone/src/components/hr/HolidaysList.tsx`

**Changes** (PR #81):
- Renamed "Lawyers" to "Users" throughout HR module
- Added task tab in internal user page
- Updated holiday list display

### 6. Matter Management
**Files Modified**:
- `touchstone/src/components/matter/MatterMasterDialog.tsx`
- `touchstone/src/components/matter/MatterMasterTable.tsx`
- `touchstone/src/components/matter/matter-detail/MatterDetailOverview.tsx`

**Changes**:
- Added engagement letter upload functionality
- Added conflict checking and raising UI
- Updated matter creation/editing forms

### 7. New Pages Added
- **`touchstone/src/app/(main)/matter/conflict/raise/[token]/page.tsx`** (NEW):
  - Page for partners to raise conflicts using a token
  - Conflict form with type, description, severity fields

### 8. Dashboard
**Files Modified**:
- `touchstone/src/components/dashboard/DashboardGrid.tsx`
- `touchstone/src/components/dashboard/widgets/TimesheetSummaryWidget.tsx`
- `touchstone/src/components/dashboard/widgets/matters/UpcomingDeadlines.tsx`

**Changes**:
- Updated widget displays to work with new data formats
- Minor UI adjustments

### 9. Contact Management
**Files Modified**:
- `touchstone/src/components/crm/ContactDetailView.tsx`

**Changes**:
- Updated contact detail display

### 10. Authentication
**Files Modified**:
- `touchstone/src/contexts/AuthContext.tsx`

**Changes**:
- Updated authentication flow
- Minor context updates

---

## ⚠️ Breaking Changes

1. **Timesheet Hours Format**:
   - Hours are now stored as integers (whole numbers only)
   - Existing decimal hours will be cast to integers (data loss possible)
   - Frontend must be updated to only accept whole numbers

2. **Task Assignments**:
   - Tasks no longer have a single `assigned_to` field
   - Must use the new `task_assignments` junction table
   - Tasks can now exist without client or matter

3. **Client/Matter Codes**:
   - New unique constraint on `client_code`
   - Existing clients without codes may need codes assigned

---

## 🔄 Migration Requirements

When pulling these changes, ensure:

1. **Run Prisma Migrations**:
   ```bash
   cd backend-express
   npx prisma migrate deploy
   # or for development:
   npx prisma migrate dev
   ```

2. **Regenerate Prisma Client**:
   ```bash
   cd backend-express
   npx prisma generate
   ```

3. **Update Dependencies** (if `package-lock.json` conflicts):
   ```bash
   cd backend-express
   npm install
   ```

4. **Frontend Dependencies**:
   ```bash
   cd touchstone
   npm install
   ```

---

## 📝 Notes

- The `package-lock.json` conflict mentioned in the server pull is likely due to dependency version differences. Resolve by accepting the remote version and running `npm install`.

- All timesheet hours are now integers. If you had decimal hours (e.g., 8.5), they will be rounded to whole numbers (e.g., 8 or 9).

- Task assignments now support multiple users. The old single-assignment model is deprecated.

- Conflict checking is a new feature that allows partners to raise conflicts for matters. This requires proper token generation and verification.

---

## 🎯 Summary of Key Features Added

1. ✅ Integer hours for timesheets (no decimals)
2. ✅ Client and matter codes with unique identifiers
3. ✅ Multiple task assignments per task
4. ✅ Optional client/matter for tasks
5. ✅ Conflict checking and raising system
6. ✅ Engagement letter uploads
7. ✅ Invoice due date auto-calculation
8. ✅ Rate card inline editing improvements
9. ✅ Table sorting for invoices and users
10. ✅ Multi-filter options for tasks and timesheets
11. ✅ User code/type auto-generation
12. ✅ HR module renamed from "Lawyers" to "Users"

---

**Last Updated**: Based on commits up to `f92752b` (PR #84 merge)




