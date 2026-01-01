import { getCategories, addCategory, getBookmarks, addBookmark, deleteBookmark, deleteCategory } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const categoryListEl = document.getElementById('category-list');
    const bookmarkGridEl = document.getElementById('bookmark-grid');
    const pageTitleEl = document.getElementById('page-title');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const modalEl = document.getElementById('modal');
    const modalTitleEl = document.getElementById('modal-title');
    const modalFormEl = document.getElementById('modal-form');
    let currentCategoryId = 'all';
    let currentSearchQuery = '';

    // Initial Load
    await renderCategories();
    await renderBookmarks('all');

    const searchInput = document.getElementById('search-input');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');

    // Theme Management
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    // Event Listeners
    addCategoryBtn.addEventListener('click', () => openModal('category'));
    addBookmarkBtn.addEventListener('click', () => openModal('bookmark'));

    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase();
        renderBookmarks(currentCategoryId);
    });

    // Close modal when clicking outside
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
    });

    function getBookmarkImage(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                let videoId = null;
                if (hostname.includes('youtu.be')) {
                    videoId = urlObj.pathname.slice(1);
                } else {
                    videoId = urlObj.searchParams.get('v');
                }

                if (videoId) {
                    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }
            }

            return `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;
        } catch (e) {
            return 'https://via.placeholder.com/150';
        }
    }

    async function renderCategories() {
        const categories = await getCategories();
        categoryListEl.innerHTML = '';

        // "All Bookmarks" Item
        const allLi = document.createElement('li');
        allLi.className = `category-item ${currentCategoryId === 'all' ? 'active' : ''}`;
        allLi.dataset.id = 'all';
        allLi.textContent = 'All Bookmarks';

        allLi.addEventListener('click', () => {
            currentCategoryId = 'all';
            document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
            allLi.classList.add('active');
            pageTitleEl.textContent = 'All Bookmarks';
            renderBookmarks('all');
        });

        categoryListEl.appendChild(allLi);

        categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = `category-item ${currentCategoryId === cat.id ? 'active' : ''}`;
            li.dataset.id = cat.id;
            li.innerHTML = `<span>${cat.name}</span> <span class="delete-cat" style="margin-left:auto; font-size:12px; color:red; display:none;">x</span>`;

            li.addEventListener('click', (e) => {
                // Determine if delete was clicked
                if (e.target.classList.contains('delete-cat')) {
                    deleteCategory(cat.id).then(() => {
                        if (currentCategoryId === cat.id) currentCategoryId = 'all';
                        renderCategories();
                        renderBookmarks(currentCategoryId);
                    });
                    return;
                }

                currentCategoryId = cat.id;
                document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                pageTitleEl.textContent = cat.name;
                renderBookmarks(cat.id);
            });

            // Show delete on hover
            li.addEventListener('mouseenter', () => li.querySelector('.delete-cat').style.display = 'block');
            li.addEventListener('mouseleave', () => li.querySelector('.delete-cat').style.display = 'none');

            categoryListEl.appendChild(li);
        });
    }

    function getGradient(str) {
        const gradients = [
            'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)', // Pinky
            'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', // Aqua
            'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', // Lavender
            'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)', // Rose
            'linear-gradient(120deg, #f6d365 0%, #fda085 100%)', // Sunset
            'linear-gradient(120deg, #d299c2 0%, #fef9d7 100%)', // Magic
            'linear-gradient(120deg, #89f7fe 0%, #66a6ff 100%)', // Blue
            'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)', // Cloud
        ];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % gradients.length;
        return gradients[index];
    }

    async function renderBookmarks(categoryId) {
        let bookmarks = await getBookmarks();
        if (categoryId !== 'all') {
            bookmarks = bookmarks.filter(b => b.categoryId === categoryId);
        }

        if (currentSearchQuery) {
            bookmarks = bookmarks.filter(b =>
                b.title.toLowerCase().includes(currentSearchQuery) ||
                b.url.toLowerCase().includes(currentSearchQuery)
            );
        }

        bookmarkGridEl.innerHTML = '';
        bookmarks.forEach(bm => {
            const imgUrl = getBookmarkImage(bm.url);
            const isFavicon = imgUrl.includes('google.com/s2/favicons');
            const bgStyle = isFavicon ? `background: ${getGradient(bm.title)};` : 'background: #F4F5F7;';

            const a = document.createElement('a');
            a.className = 'bookmark-card';
            a.href = bm.url;
            a.target = '_blank';

            a.innerHTML = `
                <div class="bookmark-visual" style="${bgStyle}">
                    <img src="${imgUrl}" alt="${bm.title}" class="${isFavicon ? 'is-favicon' : ''}">
                </div>
                <div class="bookmark-info">
                    <div class="bookmark-title">${bm.title}</div>
                    <div class="bookmark-meta">
                        <span class="bookmark-hostname">${new URL(bm.url).hostname}</span>
                    </div>
                </div>
            `;

            // Handle image error for CSP compliance
            const img = a.querySelector('img');
            img.addEventListener('error', () => {
                img.src = 'https://via.placeholder.com/150';
            });

            const footer = document.createElement('div');
            footer.className = 'bookmark-footer';

            // Copy Button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'action-btn copy-btn';
            copyBtn.title = 'Copy Link';
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/>
                </svg>
            `;
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(bm.url).then(() => {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
                    setTimeout(() => copyBtn.innerHTML = originalHtml, 2000);
                });
            };

            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn delete-btn';
            delBtn.title = 'Delete';
            delBtn.innerHTML = `
                <svg viewBox="0 0 24 24">
                   <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
            `;
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this bookmark?')) {
                    deleteBookmark(bm.id).then(() => renderBookmarks(currentCategoryId));
                }
            };

            footer.appendChild(copyBtn);
            footer.appendChild(delBtn);
            a.appendChild(footer);

            bookmarkGridEl.appendChild(a);
        });
    }

    function openModal(type) {
        modalEl.classList.add('open');
        modalFormEl.innerHTML = '';

        if (type === 'category') {
            modalTitleEl.textContent = 'New Category';
            modalFormEl.innerHTML = `
                <div class="input-group">
                    <input type="text" id="cat-name" placeholder="Category Name" required>
                </div>
                <button type="submit" class="btn">Create</button>
            `;
            modalFormEl.onsubmit = async (e) => {
                e.preventDefault();
                const name = document.getElementById('cat-name').value;
                await addCategory({ name });
                closeModal();
                renderCategories();
            };
        } else {
            modalTitleEl.textContent = 'New Bookmark';
            // We need to fetch categories to populate the select
            getCategories().then(categories => {
                let options = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                modalFormEl.innerHTML = `
                    <div class="input-group">
                        <input type="text" id="bm-title" placeholder="Title" required>
                    </div>
                    <div class="input-group">
                        <input type="url" id="bm-url" placeholder="URL" required>
                    </div>
                    <div class="input-group">
                        <select id="bm-cat">
                            <option value="">Select Category</option>
                            ${options}
                        </select>
                    </div>
                    <button type="submit" class="btn">Save</button>
                `;
                modalFormEl.onsubmit = async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('bm-title').value;
                    const url = document.getElementById('bm-url').value;
                    const categoryId = document.getElementById('bm-cat').value;
                    if (!categoryId) { alert('Please select a category'); return; }

                    await addBookmark({ title, url, categoryId });
                    closeModal();
                    renderBookmarks(currentCategoryId);
                };
            });
        }
    }

    function closeModal() {
        modalEl.classList.remove('open');
    }
});
