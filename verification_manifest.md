# Verification Plan: Auth & Database (Singularity v1.3)

To ensure the stability of the Google Login and Cloudflare D1/R2 storage systems, we need to verify the following critical path items.

## 1. Authentication & Session Security
- [ ] **Sign-In Flow**: Verify that Google OAuth works and redirects back to the dashboard without looping.
- [ ] **Session Persistence**: Ensure that refreshing the page or closing the tab does not log the user out prematurely.
- [ ] **Middleware Guard**: Verify that `/dashboard` is inaccessible if the user is unauthenticated.
- [ ] **Cross-Device Login**: Test logging in on two different browsers and verify both see the same Cloud projects.

## 2. Cloud Database (D1) CRUD
- [ ] **Empty Graph Sync**: Verify that creating a new project and saving it (even without nodes) works on the cloud.
- [ ] **Matrix/Complex Data**: Save a project with Matrix inputs and verify the JSON precision is maintained after reloading.
- [ ] **Rename Sync**: Rename a cloud project on the dashboard and verify the name updates in the DB.
- [ ] **Delete Propagation**: Delete a cloud project and verify it is removed from the DB (and local cache if applicable).

## 3. Storage Transfer & Dual-Sync
- [ ] **Local -> Cloud Transfer**: Verify that moving a local project to the cloud succeeds and the "Local" badge changes to "Cloud".
- [ ] **Cloud -> Local Download**: Verify that "Make Local Only" correctly downloads data, saves to `localStorage`, and removes the cloud record.
- [ ] **Conflict Resolution**: If the same project ID exists on Local and Cloud with different versions, verify which one wins (Timestamp-based).
- [ ] **Storage Limits**: Attempt to sync a 21st project if the limit is 20, and verify the error toast.

## 4. Error Handling & Edge Cases
- [ ] **Network Loss**: Simulate offline mode while editing a cloud project. Verify the UI provides a "Reconnecting" or "Saved Locally" fallback.
- [ ] **Large Payload**: Create a graph with 200+ nodes and verify the Cloudflare Worker does not time out (Limit is usually 1MB/Request).
