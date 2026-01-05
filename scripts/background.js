import { addCategory, getCategories, setStorage, getStorage } from './storage.js';

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: 'index.html' });
});

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        const categories = await getCategories();
        if (categories.length === 0) {
            // 1. Create Default Category
            // This creates a folder in Chrome Bookmarks named "Default"
            const defaultCat = await addCategory({ name: 'Default' });

            // 2. Fetch all existing Chrome Bookmarks
            chrome.bookmarks.getTree((results) => {
                const allBookmarks = [];

                function traverse(node) {
                    if (node.url) {
                        // It's a bookmark
                        allBookmarks.push({
                            id: node.id,
                            chromeId: node.id,
                            title: node.title,
                            url: node.url,
                            categoryId: defaultCat.id, // Assign to Default Category
                            createdAt: node.dateAdded
                        });
                    }
                    if (node.children) {
                        node.children.forEach(traverse);
                    }
                }

                results.forEach(traverse);

                // 3. Save to storage
                // We use setStorage directly to avoid creating duplicates in Chrome 
                // (since they already exist in Chrome, just not in our folder structure maybe? 
                // actually traverse finds them where they are. We just map them to 'Default' locally).
                setStorage('bookmarks', allBookmarks);
            });
        }
    }
});
