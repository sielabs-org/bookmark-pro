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
    const categories = await getCategories();
    const newCat = { ...category, id: Date.now().toString() };
    await setStorage('categories', [...categories, newCat]);
    return newCat;
};

export const deleteCategory = async (id) => {
    const categories = await getCategories();
    await setStorage('categories', categories.filter(c => c.id !== id));
};

export const getBookmarks = async () => {
    return await getStorage('bookmarks', []);
};

export const addBookmark = async (bookmark) => {
    const bookmarks = await getBookmarks();
    const newBm = { ...bookmark, id: Date.now().toString() };
    await setStorage('bookmarks', [...bookmarks, newBm]);
    return newBm;
};

export const deleteBookmark = async (id) => {
    const bookmarks = await getBookmarks();
    await setStorage('bookmarks', bookmarks.filter(b => b.id !== id));
};
