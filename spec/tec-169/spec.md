# Admin dashboard for item management

## Summary
Create an admin dashboard that allows administrators to manage items with full CRUD operations including uploading, editing, and deleting items. The dashboard should also display available item count and provide comprehensive functionality for maintaining accurate item inventory without technical assistance.

## Approved Story and Acceptance Criteria
## User Story
As an administrator, I want a dedicated dashboard to manage items with upload, edit, and delete capabilities so that I can maintain accurate and up-to-date item inventory without technical assistance.

## Acceptance Criteria
- [ ] Admin dashboard displays a paginated list of all items with key details (name, creation date, status) and supports searching by item name
- [ ] Dashboard prominently shows the total available item count and updates this count in real-time when items are added, edited, or deleted
- [ ] Upload functionality accepts common file formats and displays real-time progress with clear success/error messages upon completion
- [ ] Edit form pre-populates with existing item data and saves changes with immediate visual confirmation of successful updates
- [ ] Delete action requires explicit confirmation dialog and removes item from both dashboard view and underlying data storage
- [ ] All dashboard actions persist data changes and remain available after page refresh or session restart
- [ ] Error states provide specific, actionable feedback when operations fail due to network issues, file size limits, or invalid data
