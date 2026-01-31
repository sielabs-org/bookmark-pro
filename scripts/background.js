import { addCategory, getCategories } from './storage.js';

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: 'index.html' });
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'open_dashboard') {
        chrome.tabs.create({ url: 'index.html' });
    }
});

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // No auto-creation of folders or default categories anymore.
        // Dashboard will read whatever exists in Chrome natively.
    }
});

// All other listener logic (onCreated, onRemoved, etc.) has been removed
// because the app now reads directly from the native API on demand.
