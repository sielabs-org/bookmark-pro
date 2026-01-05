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

// Listener for external bookmark changes (e.g. Star Icon in Chrome)
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
    // Check if we already have it (to avoid loop if we created it via extension)
    const bookmarks = await getStorage('bookmarks', []);
    if (bookmarks.find(b => b.chromeId === id)) return;

    // It's a new native bookmark
    // Assign to "Default" category
    const categories = await getCategories();
    let defaultCat = categories.find(c => c.name === 'Default');
    if (!defaultCat) {
        defaultCat = await addCategory({ name: 'Default' });
    }

    const newBm = {
        id: id,
        chromeId: id,
        title: bookmark.title,
        url: bookmark.url,
        categoryId: defaultCat.id,
        createdAt: bookmark.dateAdded
    };

    // Use setStorage directly to bypass adding to Chrome (infinite loop prevention)
    setStorage('bookmarks', [...bookmarks, newBm]);
});

chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
    const bookmarks = await getStorage('bookmarks', []);
    const updated = bookmarks.filter(b => b.chromeId !== id);
    if (updated.length !== bookmarks.length) {
        setStorage('bookmarks', updated);
    }

    // Also handle category deletion (if it was a folder we were tracking)
    // Our categories link via chromeId too.
    const categories = await getCategories();
    const updatedCats = categories.filter(c => c.chromeId !== id);
    if (updatedCats.length !== categories.length) {
        setStorage('categories', updatedCats);
    }
});

chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    const bookmarks = await getStorage('bookmarks', []);
    const index = bookmarks.findIndex(b => b.chromeId === id);
    if (index !== -1) {
        bookmarks[index] = { ...bookmarks[index], title: changeInfo.title, url: changeInfo.url };
        setStorage('bookmarks', bookmarks);
    }

    // Categories (Folders) - only title changes usually
    const categories = await getCategories();
    const catIndex = categories.findIndex(c => c.chromeId === id);
    if (catIndex !== -1) {
        categories[catIndex].name = changeInfo.title;
        setStorage('categories', categories);
    }
});

chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
    // If moved to a folder we track as a category, update categoryId
    // This is tricky because we need to know if the new parent is a "Category"
    const categories = await getCategories();
    const newParentCategory = categories.find(c => c.chromeId === moveInfo.parentId);

    if (newParentCategory) {
        const bookmarks = await getStorage('bookmarks', []);
        const index = bookmarks.findIndex(b => b.chromeId === id);
        if (index !== -1 && bookmarks[index].categoryId !== newParentCategory.id) {
            bookmarks[index].categoryId = newParentCategory.id;
            setStorage('bookmarks', bookmarks);
        }
    }
});

