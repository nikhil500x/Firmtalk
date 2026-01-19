# Bulk Upload Corner Cases - Analysis & Fixes

## Identified Corner Cases

### 1. **Transaction Handling** ⚠️ CRITICAL
- **Issue**: Currently not using Prisma transactions, so partial failures leave inconsistent data
- **Risk**: If upload fails mid-way, some groups/clients/contacts may be created while others fail
- **Fix**: Wrap entire upload in `prisma.$transaction()`

### 2. **Multiple Primary Contacts** ⚠️
- **Issue**: If multiple contacts marked as primary for same client, all get created as primary
- **Risk**: Database allows multiple primary contacts, but business logic expects one
- **Fix**: Ensure only first marked primary is set, others become secondary

### 3. **Field Length Limits** ⚠️
- **Issue**: No validation for database VARCHAR/TEXT limits
- **Risk**: Very long strings could cause database errors
- **Fields to check**: client_name, contact_name, email, phone, address, notes, URLs

### 4. **Case Sensitivity in Matching** ⚠️
- **Issue**: Group/client name matching may be case-sensitive in some queries
- **Risk**: "TATA" vs "Tata" treated as different groups
- **Fix**: Ensure all comparisons use case-insensitive mode

### 5. **Empty/Whitespace Values** ✅ PARTIALLY HANDLED
- **Issue**: Empty strings vs null vs whitespace-only
- **Current**: Some trimming done, but not comprehensive
- **Fix**: Trim all string fields, convert empty to null

### 6. **Email Validation** ⚠️
- **Issue**: Basic regex may not catch all edge cases
- **Edge cases**: Plus signs (user+tag@domain.com), multiple dots, international domains
- **Fix**: More robust email validation

### 7. **URL Validation** ⚠️
- **Issue**: No validation for website, LinkedIn, Twitter URLs
- **Risk**: Invalid URLs stored in database
- **Fix**: Validate URL format or at least check basic structure

### 8. **Phone Number Formats** ⚠️
- **Issue**: No validation for phone number format
- **Risk**: Invalid phone numbers stored
- **Fix**: Basic phone validation (digits, +, -, spaces, parentheses)

### 9. **Concurrent Uploads** ⚠️
- **Issue**: Two users uploading same group/client simultaneously
- **Risk**: Duplicate creation or race conditions
- **Fix**: Use database unique constraints + proper error handling

### 10. **Very Large Files** ⚠️
- **Issue**: Large Excel files could cause memory issues
- **Current**: 25MB limit, but no row count limit
- **Fix**: Add row count validation (e.g., max 10,000 rows)

### 11. **Invalid Excel Structure** ✅ PARTIALLY HANDLED
- **Issue**: Missing columns, wrong sheet names, corrupted files
- **Current**: Basic validation exists
- **Fix**: More robust error messages

### 12. **Special Characters** ⚠️
- **Issue**: Unicode, emojis, special characters in names
- **Risk**: Database encoding issues or display problems
- **Fix**: Sanitize or validate character sets

### 13. **Duplicate Rows in Excel** ⚠️
- **Issue**: Same contact appears multiple times in Excel
- **Risk**: Multiple attempts to create same contact
- **Fix**: Deduplicate during parsing or handle gracefully

### 14. **Missing Required Fields After Editing** ⚠️
- **Issue**: User might delete required fields in preview
- **Risk**: Validation errors during confirmation
- **Fix**: Re-validate before confirmation

### 15. **Group Name Conflicts** ⚠️
- **Issue**: Group name exists but user wants to create new one
- **Risk**: Unintended use of existing group
- **Fix**: Clear indication in preview, allow override option

### 16. **Client Code Uniqueness** ✅ HANDLED
- **Issue**: Client code must be unique
- **Current**: Checked in preview and confirmation
- **Status**: OK

### 17. **Contact Email Uniqueness Per Client** ✅ HANDLED
- **Issue**: Same email can't exist twice for same client
- **Current**: Checked in preview and confirmation
- **Status**: OK

### 18. **Primary Contact Auto-Assignment** ✅ HANDLED
- **Issue**: If no primary contact, first one is auto-assigned
- **Current**: Logic exists
- **Status**: OK

### 19. **Database Foreign Key Constraints** ⚠️
- **Issue**: If group creation fails, client creation will fail
- **Risk**: Cascading failures
- **Fix**: Transaction ensures atomicity

### 20. **String Trimming and Normalization** ⚠️
- **Issue**: Leading/trailing whitespace, multiple spaces
- **Risk**: "TATA " vs "TATA" treated as different
- **Fix**: Comprehensive trimming and normalization

