# Admin dashboard for item management

## Summary
Create an admin dashboard that allows administrators to manage items with full CRUD operations. The dashboard should provide functionality for uploading new items, editing existing items, and deleting items from the system.

## Approved Story and Acceptance Criteria
## User Story
As a system administrator, I want an admin dashboard to manage items through uploading, editing, and deleting operations so that I can maintain accurate and up-to-date item records in the system.

## Acceptance Criteria
- [ ] Admin can access a dedicated dashboard page that displays all existing items in a paginated list or table format with basic item information visible
- [ ] Admin can upload new items through a form interface that accepts required item fields and saves successfully to the database with confirmation feedback
- [ ] Admin can edit existing items by clicking on an item to open an editable form, modify fields, and save changes with validation and success confirmation
- [ ] Admin can delete items through a delete action that requires confirmation prompt and removes the item permanently from the system with success notification
- [ ] Dashboard displays appropriate error messages when operations fail due to validation errors, network issues, or server problems without breaking the interface
- [ ] All dashboard interactions are accessible via keyboard navigation and screen readers, with proper ARIA labels and focus management for form elements and action buttons
