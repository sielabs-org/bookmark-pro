// Helper to get item from local storage
export const getStorage = (key, defaultVal) => {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || defaultVal);
        });
    });
};

export const setStorage = (key, value) => {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
};

export const getCategories = async () => {
    return await getStorage('categories', []);
};

export const addCategory = async (category) => {
    // 1. Create in Chrome Bookmarks
    const chromeNode = await chrome.bookmarks.create({
        title: category.name
    });

    // 2. Save to Local Storage with chromeId
    const categories = await getCategories();
    // Use chromeNode.id as the internal id to keep them linked easily
    const newCat = {
        ...category,
        id: chromeNode.id,
        chromeId: chromeNode.id
    };
    await setStorage('categories', [...categories, newCat]);
    return newCat;
};

export const deleteCategory = async (id) => {
    // 1. Remove from Chrome Bookmarks
    try {
        await chrome.bookmarks.removeTree(id);
    } catch (e) {
        console.warn('Failed to remove from chrome bookmarks', e);
    }

    // 2. Remove from Local Storage
    const categories = await getCategories();
    await setStorage('categories', categories.filter(c => c.id !== id));
};

export const getBookmarks = async () => {
    return await getStorage('bookmarks', []);
};

export const addBookmark = async (bookmark) => {
    // 1. Create in Chrome Bookmarks
    // Note: bookmark.categoryId matches the Chrome Folder ID (see addCategory)
    // If categoryId is 'all' or undefined, we might need a default parent.
    // However, our UI enforces a category selection.

    // Fallback if trying to save to "all" (shouldn't happen with current UI but safety first)
    const parentId = (bookmark.categoryId && bookmark.categoryId !== 'all') ? bookmark.categoryId : '1'; // '1' is usually Bookmarks Bar

    const chromeNode = await chrome.bookmarks.create({
        parentId: parentId,
        title: bookmark.title,
        url: bookmark.url
    });

    // 2. Save to Local Storage
    const bookmarks = await getBookmarks();
    const newBm = {
        ...bookmark,
        id: chromeNode.id,
        chromeId: chromeNode.id
    };
    await setStorage('bookmarks', [...bookmarks, newBm]);
    return newBm;
};

export const deleteBookmark = async (id) => {
    // 1. Remove from Chrome Bookmarks
    try {
        await chrome.bookmarks.remove(id);
    } catch (e) {
        console.warn('Failed to remove chrome bookmark', e);
    }

    // 2. Remove from Local Storage
    const bookmarks = await getBookmarks();
    await setStorage('bookmarks', bookmarks.filter(b => b.id !== id));
};

export const moveBookmark = async (id, newCategoryId) => {
    // 1. Move in Chrome Bookmarks
    // newCategoryId is the Chrome Folder ID
    try {
        await chrome.bookmarks.move(id, { parentId: newCategoryId });
    } catch (e) {
        console.warn('Failed to move chrome bookmark', e);
        return;
    }

    // 2. Update Local Storage
    const bookmarks = await getBookmarks();
    const updatedBookmarks = bookmarks.map(b => {
        if (b.id === id) {
            return { ...b, categoryId: newCategoryId };
        }
        return b;
    });
    await setStorage('bookmarks', updatedBookmarks);
};

export const updateBookmark = async (id, changes) => {
    // 1. Update in Chrome Bookmarks
    try {
        await chrome.bookmarks.update(id, {
            title: changes.title,
            url: changes.url
        });
        if (changes.categoryId) {
            await chrome.bookmarks.move(id, { parentId: changes.categoryId });
        }
    } catch (e) {
        console.warn('Failed to update chrome bookmark', e);
    }

    // 2. Update Local Storage
    const bookmarks = await getBookmarks();
    const updatedBookmarks = bookmarks.map(b => {
        if (b.id === id) {
            return { ...b, ...changes };
        }
        return b;
    });
    await setStorage('bookmarks', updatedBookmarks);
};
