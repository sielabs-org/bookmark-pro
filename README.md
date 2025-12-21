# Bookmark Pro

Bookmark Pro is a premium Chrome Extension for managing bookmarks with custom categories. It offers a clean, dashboard to organize your links effectively.

## Features

- **Dashboard**: A beautiful grid view of your bookmarks.
- **Custom Categories**: Organize bookmarks into tags like "Open Source", "Data Engineering", etc.
- **Quick Add Popup**: Easily save the current tab to a category using the extension popup.
- **Persistent Storage**: All data is saved locally in your browser.
- **Responsive Design**: Polished UI that works on various screen sizes.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the root folder of this project (`bookmark-pro`).

## Usage

### Adding a Category
1. Open the Dashboard (click the extension icon -> "Open Dashboard").
2. Click **+ New Category** in the sidebar.
3. Enter a name and click Create.

### Adding a Bookmark
1. Navigate to any website you want to save.
2. Click the **Bookmark Pro icon** in the Chrome toolbar.
3. Enter a Title (auto-filled) and select a Category.
4. Click **Save Bookmark**.

### Managing Bookmarks
- **View**: Click a category in the sidebar to filter bookmarks.
- **Delete**: Hover over a bookmark card or category in the sidebar to reveal the delete options.

## Project Structure

- `manifest.json`: Chrome Extension configuration (Manifest V3).
- `index.html`: The main dashboard page.
- `popup.html`: The browser action popup.
- `styles.css`: Global styles and variables.
- `scripts/`: JavaScript logic for the dashboard, popup, and storage.
- `assets/`: Icons and images.

## Technologies

- HTML5
- CSS3 (Vanilla, CSS Variables)
- JavaScript (ES6+)
- Chrome Extension APIs (Storage, Tabs, Bookmarks)
