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

    // Initial Load
    await renderCategories();
    await renderBookmarks('all');

    // Event Listeners
    addCategoryBtn.addEventListener('click', () => openModal('category'));
    addBookmarkBtn.addEventListener('click', () => openModal('bookmark'));

    // Close modal when clicking outside
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeModal();
    });

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

        bookmarkGridEl.innerHTML = '';
        bookmarks.forEach(bm => {
            const a = document.createElement('a');
            a.className = 'bookmark-card';
            a.href = bm.url;
            a.target = '_blank';
            a.innerHTML = `
                <div class="bookmark-title">${bm.title}</div>
                <div class="bookmark-url">${new URL(bm.url).hostname}</div>
            `;
            // Right click to delete? Or add a delete button. Let's add a small delete button for now.
            const delBtn = document.createElement('button');
            delBtn.innerText = 'x';
            delBtn.style.cssText = "align-self: flex-end; background: none; border: none; color: #999; cursor: pointer;";
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteBookmark(bm.id).then(() => renderBookmarks(currentCategoryId));
            };
            a.prepend(delBtn);

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
