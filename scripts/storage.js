
// Wrapper for Chrome Bookmarks API

export const getCategories = () => {
    return new Promise((resolve) => {
        chrome.bookmarks.getTree((results) => {
            const categories = [];

            // Allow root level folders (Bookmarks Bar, Other Bookmarks) to count as categories
            // if they have children.
            // Also traverse standard folders.

            function traverse(node) {
                // If it is a folder (check if it has 'children' and 'id' is NOT '0' (Root))
                if (node.children && node.id !== '0') {
                    const isSystem = ['1', '2', '3'].includes(node.id);
                    categories.push({
                        id: node.id,
                        name: node.title || (node.id === '1' ? 'Bookmarks Bar' : (node.id === '2' ? 'Other Bookmarks' : 'Folder')),
                        chromeId: node.id,
                        deletable: !isSystem,
                        parentId: node.parentId,
                        index: node.index
                    });
                    node.children.forEach(traverse);
                } else if (node.children && node.id === '0') {
                    // It's root, just traverse children
                    node.children.forEach(traverse);
                }
            }

            results.forEach(traverse);
            resolve(categories);
        });
    });
};

export const moveCategory = (id, newParentId, newIndex) => {
    return new Promise((resolve, reject) => {
        let destination = { parentId: newParentId };
        if (newIndex !== undefined && newIndex !== null) {
            destination.index = newIndex;
        }
        chrome.bookmarks.move(id, destination, (node) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve(node);
        });
    });
};

export const addCategory = (category) => {
    return new Promise((resolve, reject) => {
        // Create folder in "Other Bookmarks" (id '2') by default if no parent specified,
        // or let Chrome decide (usually appends to ends of main list if parentId not given, but explicit is better)
        // Actually, if we just create without parentId, it goes to "Other Bookmarks" usually.
        chrome.bookmarks.create({
            parentId: '2', // Default to 'Other Bookmarks' to keep 'Bookmarks Bar' clean? Or '1'? Let's use '2' "Other"
            title: category.name
        }, (node) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve({
                id: node.id,
                name: node.title,
                chromeId: node.id
            });
        });
    });
};

export const deleteCategory = (id) => {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.removeTree(id, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
        });
    });
};

export const getBookmarks = () => {
    return new Promise((resolve) => {
        chrome.bookmarks.getTree((results) => {
            const bookmarks = [];

            function traverse(node, parentId = null) {
                if (node.url) {
                    bookmarks.push({
                        id: node.id,
                        title: node.title,
                        url: node.url,
                        categoryId: parentId,
                        chromeId: node.id,
                        createdAt: node.dateAdded
                    });
                }
                if (node.children) {
                    node.children.forEach(child => traverse(child, node.id));
                }
            }
            results.forEach(node => traverse(node)); // Root doesn't have parentId relevant for us
            resolve(bookmarks);
        });
    });
};

export const addBookmark = (bookmark) => {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.create({
            parentId: bookmark.categoryId,
            title: bookmark.title,
            url: bookmark.url
        }, (node) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve({
                id: node.id,
                title: node.title,
                url: node.url,
                categoryId: node.parentId,
                chromeId: node.id
            });
        });
    });
};

export const deleteBookmark = (id) => {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.remove(id, () => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve();
        });
    });
};

export const moveBookmark = (id, newCategoryId) => {
    return new Promise((resolve, reject) => {
        chrome.bookmarks.move(id, { parentId: newCategoryId }, (node) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve(node);
        });
    });
};

export const updateBookmark = (id, changes) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (changes.title || changes.url) {
                await new Promise((res, rej) => {
                    chrome.bookmarks.update(id, { title: changes.title, url: changes.url }, () => {
                        if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
                        else res();
                    });
                });
            }

            if (changes.categoryId) {
                await new Promise((res, rej) => {
                    chrome.bookmarks.move(id, { parentId: changes.categoryId }, () => {
                        if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
                        else res();
                    });
                });
            }
            resolve();
        } catch (e) {
            reject(e);
        }
    });
};
