# Server Merge Conflict Resolution Guide

## Current Situation

You're on the server (`ubuntu@ip-172-31-42-15`) and have a merge conflict in `backend-express/package-lock.json` after pulling changes from the remote repository.

## Quick Resolution Steps

### Step 1: Resolve the package-lock.json Conflict

The `package-lock.json` file has a merge conflict. For this file, the safest approach is to:

```bash
# Accept the remote version (theirs)
git checkout --theirs backend-express/package-lock.json

# Mark as resolved
git add backend-express/package-lock.json
```

### Step 2: Regenerate package-lock.json (Recommended)

After accepting the remote version, regenerate it to ensure consistency:

```bash
cd backend-express
npm install
cd ..
```

### Step 3: Complete the Merge

```bash
git commit -m "Resolve merge conflict in package-lock.json"
```

### Step 4: Verify Everything is Up to Date

```bash
git status
git log --oneline -5
```

---

## Alternative: Delete and Regenerate (Safest)

If you want to be absolutely sure there are no conflicts:

```bash
# Remove the conflicted file
rm backend-express/package-lock.json

# Mark as resolved (git will see it as deleted)
git add backend-express/package-lock.json

# Regenerate the lock file
cd backend-express
npm install
cd ..

# Complete the merge
git commit -m "Resolve merge conflict by regenerating package-lock.json"
```

---

## After Resolving the Conflict

### 1. Run Database Migrations

The pull includes several new migrations. You need to apply them:

```bash
cd backend-express
npx prisma migrate deploy
npx prisma generate
```

**Important Migrations to Apply**:
- `20251226120136_client_matter_codes_creation_requester_and_timesheets_hours_as_int`
- `20251224121144_make_client_matter_optional_in_tasks`
- `20251224061427_add_task_assignments`
- `20251224073254_add_completed_by_to_task_assignments`
- `20251222114949_engagement_letter_and_conflict_checker_initial`

### 2. Restart Services

After migrations, restart your backend:

```bash
# If using PM2
pm2 restart backend

# Or if running directly
cd backend-express
npm run dev
```

### 3. Verify Changes

Check that:
- Timesheet hours are now integers (no decimals)
- Tasks can have multiple assignments
- Tasks can exist without client/matter
- Conflict checking is available
- Engagement letter uploads work

---

## Key Changes to Be Aware Of

### ⚠️ Breaking Change: Timesheet Hours

**Before**: Hours were stored as decimals (e.g., 8.5, 7.25)  
**After**: Hours are now integers only (e.g., 8, 7)

**Impact**: 
- Existing timesheet entries with decimal hours will be cast to integers
- Frontend must only accept whole numbers
- All timesheet calculations now use integers

### ✅ New Features

1. **Multiple Task Assignments**: Tasks can now be assigned to multiple users
2. **Optional Client/Matter**: Tasks don't require a client or matter
3. **Conflict Checking**: Partners can raise conflicts for matters
4. **Client/Matter Codes**: Unique codes for better tracking
5. **Invoice Due Date Logic**: Auto-calculated based on timesheet dates

---

## Troubleshooting

### If npm install fails:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
cd backend-express
rm -rf node_modules package-lock.json
npm install
```

### If Prisma migrations fail:

```bash
# Check migration status
cd backend-express
npx prisma migrate status

# If needed, reset (WARNING: This will drop all data)
# npx prisma migrate reset

# Or apply migrations manually
npx prisma migrate deploy
```

### If backend won't start:

1. Check that all migrations are applied
2. Verify Prisma client is generated: `npx prisma generate`
3. Check environment variables are set correctly
4. Review error logs

---

## Summary

The conflict is only in `package-lock.json`, which is auto-generated. The resolution is straightforward:

1. Accept remote version or delete and regenerate
2. Run `npm install` to regenerate
3. Complete the merge commit
4. Apply database migrations
5. Restart services

The actual code changes are compatible and should work together without issues.




