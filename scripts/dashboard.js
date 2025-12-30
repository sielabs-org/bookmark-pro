import { getCategories, addCategory, getBookmarks, addBookmark, deleteBookmark, deleteCategory } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const categoryListEl = document.getElementById('category-list');
    const bookmarkGridEl = document.getElementById('bookmark-grid');
    const pageTitleEl = document.getElementById('page-title');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const shareBtn = document.getElementById('share-btn');
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

    // Event Listeners
    addCategoryBtn.addEventListener('click', () => openModal('category'));
    addBookmarkBtn.addEventListener('click', () => openModal('bookmark'));

    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase();
        renderBookmarks(currentCategoryId);
    });

    shareBtn.addEventListener('click', () => {
        const shareUrl = "https://chrome.google.com/webstore/detail/bookmark-pro/placeholder-id";
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("Share link copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert("Failed to copy link.");
        });
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
        categoryListEl.innerHTML = `
            <li class="category-item ${currentCategoryId === 'all' ? 'active' : ''}" data-id="all">
                All Bookmarks
            </li>
        `;
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
            const a = document.createElement('a');
            a.className = 'bookmark-card';
            a.href = bm.url;
            a.target = '_blank';
            a.innerHTML = `
                <img src="${getBookmarkImage(bm.url)}" alt="${bm.title}" class="bookmark-image" onerror="this.src='https://via.placeholder.com/150'">
                <div class="bookmark-title">${bm.title}</div>
                <div class="bookmark-url">${new URL(bm.url).hostname}</div>
            `;
            // Right click to delete? Or add a delete button. Let's add a small delete button for now.
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = "align-self: flex-end; display: flex; gap: 5px; margin-top: auto;";

            const copyBtn = document.createElement('button');
            copyBtn.innerText = 'Copy';
            copyBtn.className = 'btn';
            copyBtn.title = 'Copy Link';
            copyBtn.style.cssText = "font-size: 12px; padding: 4px 8px; background-color: var(--color-primary);";
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigator.clipboard.writeText(bm.url).then(() => {
                    const originalText = copyBtn.innerText;
                    copyBtn.innerText = 'Copied';
                    setTimeout(() => {
                        copyBtn.innerText = originalText;
                    }, 2000);
                });
            };

            const delBtn = document.createElement('button');
            delBtn.innerText = 'x';
            delBtn.title = 'Delete';
            delBtn.style.cssText = "background: none; border: none; color: #999; cursor: pointer; font-size: 16px; align-self: center;";
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteBookmark(bm.id).then(() => renderBookmarks(currentCategoryId));
            };

            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(delBtn);
            a.appendChild(actionsDiv);

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
