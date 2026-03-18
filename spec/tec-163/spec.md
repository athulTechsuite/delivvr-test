# Admin Dashboard for Item Management

## Summary
Develop an admin dashboard that allows administrators to manage items with full CRUD operations including upload, edit, and delete functionality. The dashboard must support image uploads with a 200KB file size limit and display available item counts.

## Approved Story and Acceptance Criteria
## User Story
As an administrator, I want to access a dedicated dashboard where I can upload new items, edit existing items, and delete items so that I can maintain accurate and up-to-date content in the system.

## Acceptance Criteria
- [ ] The admin dashboard displays a list of all existing items with their key details (title, creation date, status) in a searchable and sortable table format along with the total count of available items
- [ ] When uploading a new item, the system accepts the item data, validates required fields, and saves the item to the database with a success confirmation message displayed to the user
- [ ] When uploading an image as part of an item, the system enforces a maximum file size of 200KB and displays a clear error message if the image exceeds this limit
- [ ] When editing an existing item, the system pre-populates the edit form with current item data, allows modifications to all editable fields, and saves changes with a clear success indicator
- [ ] When deleting an item, the system displays a confirmation dialog requiring explicit user confirmation before permanently removing the item from the database and updates the available item count
- [ ] All form submissions include client-side and server-side validation with specific error messages displayed for invalid or missing data
- [ ] The dashboard is accessible via keyboard navigation and screen readers, meeting WCAG 2.1 AA standards for administrative interfaces
