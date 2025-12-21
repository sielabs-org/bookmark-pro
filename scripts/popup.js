import { getCategories, addBookmark, addCategory } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const titleInput = document.getElementById('bm-title');
    const urlInput = document.getElementById('bm-url');
    const catSelect = document.getElementById('bm-cat');
    const newCatGroup = document.getElementById('new-cat-group');
    const newCatInput = document.getElementById('new-cat-name');
    const form = document.getElementById('popup-form');
    const openDashboardLink = document.getElementById('open-dashboard');

    // Populate current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab) {
            titleInput.value = tab.title;
            urlInput.value = tab.url;
        }
    });

    // Populate categories
    async function loadCategories() {
        // Clear existing options except default ones
        while (catSelect.options.length > 2) {
            catSelect.remove(2);
        }

        const categories = await getCategories();
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            catSelect.appendChild(option);
        });
    }
    await loadCategories();

    // Handle select change
    catSelect.addEventListener('change', () => {
        if (catSelect.value === 'new') {
            newCatGroup.style.display = 'block';
            newCatInput.required = true;
            newCatInput.focus();
        } else {
            newCatGroup.style.display = 'none';
            newCatInput.required = false;
        }
    });

    // Handle form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput.value;
        const url = urlInput.value;
        let categoryId = catSelect.value;

        if (categoryId === 'new') {
            const catName = newCatInput.value.trim();
            if (!catName) {
                alert('Please enter a category name');
                return;
            }
            const newCat = await addCategory({ name: catName });
            categoryId = newCat.id;
        }

        await addBookmark({ title, url, categoryId });
        window.close();
    });

    // Open Dashboard
    openDashboardLink.addEventListener('click', () => {
        chrome.tabs.create({ url: 'index.html' });
    });
});
