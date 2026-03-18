# Admin dashboard for item management

## Summary
Implement a comprehensive admin dashboard that allows administrators to manage items through complete CRUD operations including uploading, editing, and deleting. The dashboard should include search/filter functionality, pagination, and validation with specific requirements for image uploads under 200kb.

## Confirmed PRD
## User Story
As a system administrator, I want a comprehensive dashboard to manage items through upload, edit, and delete operations so that I can maintain accurate and up-to-date item inventory without requiring technical assistance.

## Acceptance Criteria
- [ ] The admin dashboard displays a paginated list of all items with key information (name, status, created date, last modified date) and supports sorting by each column
- [ ] Users can upload new items through a form that validates required fields and file formats, restricts image uploads to 200kb maximum size, displays upload progress, and confirms successful creation with appropriate error messages for failures including file size violations
- [ ] Users can edit existing items by clicking an edit button that opens a pre-populated form, allows modification of all editable fields with the same 200kb image size restriction, and saves changes with confirmation messaging
- [ ] Users can delete items through a delete button that displays a confirmation dialog requiring explicit confirmation before permanent removal and shows success confirmation afterward
- [ ] The dashboard includes search and filter functionality that allows users to find specific items by name, status, or date range with results updating in real-time
- [ ] All dashboard actions persist data correctly to the database, handle network errors gracefully with retry options, and maintain user session state throughout operations
